from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
import hashlib
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any

import bcrypt
import jwt
import httpx
import razorpay
from google.oauth2 import id_token as g_id_token
from google.auth.transport import requests as g_requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from html import escape

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "NexoraOS"
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nexoraos")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

razor_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

app = FastAPI(title="NexoraOS API")
api = APIRouter(prefix="/api")

# ---------- Helpers ----------
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False

def make_token(user_id: str, cafe_id: str, role: str, days: int = 7) -> str:
    payload = {"sub": user_id, "cafe_id": cafe_id, "role": role,
               "exp": now_utc() + timedelta(days=days)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user

def require_roles(*roles):
    async def _dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return _dep

def clean(d):
    if isinstance(d, dict):
        d.pop("_id", None)
    return d

async def send_email(to: str, subject: str, html: str) -> bool:
    if not EMAIL_KEY or EMAIL_KEY.startswith("{"):
        logger.warning("Email not configured; would send to %s: %s", to, subject)
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Email send failed: %s", e)
        return False

async def send_otp_email(to: str, otp: str, purpose: str = "verification"):
    brand = escape(EMAIL_FROM_NAME)
    html = f"""
    <table role='presentation' width='100%'><tr><td style='padding:32px;font-family:Arial,sans-serif;background:#FDFBF7'>
      <h2 style='color:#3D271D;margin:0 0 16px'>Your {brand} OTP</h2>
      <p style='color:#6B5A52'>Use the code below to complete your {escape(purpose)}. It expires in 10 minutes.</p>
      <div style='font-size:32px;letter-spacing:8px;font-weight:800;color:#3D271D;background:#F5ECE1;padding:16px 24px;border-radius:12px;display:inline-block;margin:16px 0'>{escape(otp)}</div>
      <p style='color:#9C8A80;font-size:12px'>If you did not request this, ignore this email.</p>
      <p style='color:#9C8A80;font-size:12px'>— {brand}, Café Operations Simplified</p>
    </td></tr></table>
    """
    logger.info("OTP for %s (%s): %s", to, purpose, otp)  # dev aid; remove in prod
    return await send_email(to, f"Your {EMAIL_FROM_NAME} verification code: {otp}", html)

# ---------- Startup ----------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.otps.create_index("expires_at", expireAfterSeconds=0)
    await db.otps.create_index([("email", 1), ("purpose", 1)])
    await db.cafes.create_index("owner_id")
    for coll in ["categories", "products", "tables", "orders", "customers", "inventory", "stock_txns", "subscriptions", "invoices", "settings"]:
        await db[coll].create_index("cafe_id")
    await db.orders.create_index([("cafe_id", 1), ("status", 1)])
    # Seed admin
    if ADMIN_EMAIL and ADMIN_PASSWORD:
        existing = await db.users.find_one({"email": ADMIN_EMAIL})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": ADMIN_EMAIL, "name": "NexoraOS Admin",
                "password_hash": hash_pw(ADMIN_PASSWORD), "role": "admin",
                "cafe_id": None, "verified": True, "created_at": iso(now_utc()),
            })
            logger.info("Admin seeded: %s", ADMIN_EMAIL)
        elif not verify_pw(ADMIN_PASSWORD, existing["password_hash"]):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_pw(ADMIN_PASSWORD), "role": "admin"}})
            logger.info("Admin password updated")
    logger.info("Indexes ready")

# ---------- Auth ----------
class SignupBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    cafe_name: str

class VerifyOtpBody(BaseModel):
    email: EmailStr
    otp: str
    password: Optional[str] = None
    new_password: Optional[str] = None

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class ForgotBody(BaseModel):
    email: EmailStr

class ResetBody(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(min_length=6)

def gen_otp() -> str:
    return f"{random.randint(0, 999999):06d}"

@api.post("/auth/signup")
async def signup(body: SignupBody, bg: BackgroundTasks):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email, "verified": True})
    if existing:
        raise HTTPException(400, "Email already registered")
    # store pending signup as OTP with payload
    otp = gen_otp()
    await db.otps.update_one(
        {"email": email, "purpose": "signup"},
        {"$set": {
            "email": email, "purpose": "signup", "otp": otp,
            "expires_at": now_utc() + timedelta(minutes=10),
            "payload": {
                "name": body.name,
                "cafe_name": body.cafe_name,
                "password_hash": hash_pw(body.password),
            },
        }},
        upsert=True,
    )
    bg.add_task(send_otp_email, email, otp, "signup")
    return {"message": "OTP sent", "email": email}

@api.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtpBody):
    email = body.email.lower()
    rec = await db.otps.find_one({"email": email, "purpose": "signup"})
    if not rec or rec["otp"] != body.otp:
        raise HTTPException(400, "Invalid or expired OTP")
    if rec["expires_at"].replace(tzinfo=timezone.utc) < now_utc() if rec["expires_at"].tzinfo is None else rec["expires_at"] < now_utc():
        raise HTTPException(400, "OTP expired")
    payload = rec.get("payload", {})
    # Create cafe first
    cafe_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    await db.cafes.insert_one({
        "id": cafe_id, "name": payload.get("cafe_name", "My Café"),
        "owner_id": user_id, "gstin": "", "address": "",
        "phone": "", "tax_rate": 5.0, "currency": "INR",
        "created_at": iso(now_utc()),
    })
    await db.users.insert_one({
        "id": user_id, "email": email, "name": payload.get("name", ""),
        "password_hash": payload["password_hash"],
        "role": "owner", "cafe_id": cafe_id, "verified": True,
        "created_at": iso(now_utc()),
    })
    # Trial subscription (14d)
    await db.subscriptions.insert_one({
        "id": str(uuid.uuid4()), "cafe_id": cafe_id, "plan": "trial",
        "billing_cycle": "trial", "status": "active",
        "started_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=14)),
        "amount": 0, "payment_id": None,
    })
    await db.otps.delete_one({"_id": rec["_id"]})
    token = make_token(user_id, cafe_id, "owner")
    return {"token": token, "user": {"id": user_id, "email": email, "name": payload.get("name"), "role": "owner", "cafe_id": cafe_id}}

@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("verified") or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(user["id"], user["cafe_id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user.get("name"), "role": user["role"], "cafe_id": user["cafe_id"]}}

class GoogleLoginBody(BaseModel):
    credential: str  # Google ID token
    cafe_name: Optional[str] = None  # required for new signups

@api.post("/auth/google")
async def google_login(body: GoogleLoginBody):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google login not configured")
    try:
        info = g_id_token.verify_oauth2_token(body.credential, g_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception as e:
        logger.warning("Google token verify failed: %s", e)
        raise HTTPException(401, "Invalid Google token")
    email = info.get("email", "").lower()
    name = info.get("name") or email.split("@")[0]
    if not email:
        raise HTTPException(400, "Google account has no email")
    user = await db.users.find_one({"email": email})
    if not user:
        # First-time Google sign-in: create user + café
        cafe_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        await db.cafes.insert_one({
            "id": cafe_id, "name": body.cafe_name or f"{name}'s Café",
            "owner_id": user_id, "gstin": "", "address": "",
            "phone": "", "tax_rate": 5.0, "currency": "INR",
            "created_at": iso(now_utc()),
        })
        await db.users.insert_one({
            "id": user_id, "email": email, "name": name,
            "password_hash": hash_pw(secrets.token_urlsafe(24)),  # unusable — Google-only
            "role": "owner", "cafe_id": cafe_id, "verified": True,
            "auth_provider": "google", "created_at": iso(now_utc()),
        })
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()), "cafe_id": cafe_id, "plan": "trial",
            "billing_cycle": "trial", "status": "active",
            "started_at": iso(now_utc()),
            "expires_at": iso(now_utc() + timedelta(days=14)),
            "amount": 0, "payment_id": None,
        })
        user = await db.users.find_one({"id": user_id})
    if user["role"] == "admin":
        raise HTTPException(403, "Use admin login")
    token = make_token(user["id"], user["cafe_id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user.get("name"), "role": user["role"], "cafe_id": user["cafe_id"]}}

@api.post("/auth/forgot-password")
async def forgot(body: ForgotBody, bg: BackgroundTasks):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "verified": True})
    if user:
        otp = gen_otp()
        await db.otps.update_one(
            {"email": email, "purpose": "reset"},
            {"$set": {"email": email, "purpose": "reset", "otp": otp,
                      "expires_at": now_utc() + timedelta(minutes=10)}},
            upsert=True,
        )
        bg.add_task(send_otp_email, email, otp, "password reset")
    return {"message": "If that email is registered, an OTP has been sent."}

@api.post("/auth/reset-password")
async def reset(body: ResetBody):
    email = body.email.lower()
    rec = await db.otps.find_one({"email": email, "purpose": "reset"})
    if not rec or rec["otp"] != body.otp:
        raise HTTPException(400, "Invalid or expired OTP")
    exp = rec["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(400, "OTP expired")
    await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_pw(body.new_password)}})
    await db.otps.delete_one({"_id": rec["_id"]})
    return {"message": "Password reset"}

@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"message": "Logged out"}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    cafe = await db.cafes.find_one({"id": user["cafe_id"]}, {"_id": 0})
    return {"user": user, "cafe": cafe}

# ---------- Cafe / Settings ----------
class CafeUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    tax_rate: Optional[float] = None

@api.patch("/cafe")
async def update_cafe(body: CafeUpdate, user: dict = Depends(require_roles("owner", "manager"))):
    patch = {k: v for k, v in body.dict().items() if v is not None}
    if patch:
        await db.cafes.update_one({"id": user["cafe_id"]}, {"$set": patch})
    cafe = await db.cafes.find_one({"id": user["cafe_id"]}, {"_id": 0})
    return cafe

# ---------- Categories ----------
class CategoryBody(BaseModel):
    name: str
    icon: Optional[str] = None
    sort_order: int = 0

@api.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    docs = await db.categories.find({"cafe_id": user["cafe_id"]}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return docs

@api.post("/categories")
async def create_category(body: CategoryBody, user: dict = Depends(require_roles("owner", "manager"))):
    doc = {"id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], **body.dict()}
    await db.categories.insert_one(doc)
    return clean(doc)

@api.patch("/categories/{cid}")
async def update_category(cid: str, body: CategoryBody, user: dict = Depends(require_roles("owner", "manager"))):
    await db.categories.update_one({"id": cid, "cafe_id": user["cafe_id"]}, {"$set": body.dict()})
    doc = await db.categories.find_one({"id": cid}, {"_id": 0})
    return doc

@api.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("owner", "manager"))):
    await db.categories.delete_one({"id": cid, "cafe_id": user["cafe_id"]})
    return {"ok": True}

# ---------- Products ----------
class ProductBody(BaseModel):
    name: str
    category_id: str
    description: Optional[str] = ""
    price: float
    tax_rate: float = 5.0
    sku: Optional[str] = ""
    prep_time: int = 5
    available: bool = True

@api.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    return await db.products.find({"cafe_id": user["cafe_id"]}, {"_id": 0}).to_list(2000)

@api.post("/products")
async def create_product(body: ProductBody, user: dict = Depends(require_roles("owner", "manager"))):
    doc = {"id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], **body.dict()}
    await db.products.insert_one(doc)
    return clean(doc)

@api.patch("/products/{pid}")
async def update_product(pid: str, body: ProductBody, user: dict = Depends(require_roles("owner", "manager"))):
    await db.products.update_one({"id": pid, "cafe_id": user["cafe_id"]}, {"$set": body.dict()})
    return await db.products.find_one({"id": pid}, {"_id": 0})

@api.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_roles("owner", "manager"))):
    await db.products.delete_one({"id": pid, "cafe_id": user["cafe_id"]})
    return {"ok": True}

# ---------- Tables ----------
class TableBody(BaseModel):
    number: int
    capacity: int = 4
    status: str = "available"  # available | occupied | reserved

class TableUpdate(BaseModel):
    status: Optional[str] = None
    guests: Optional[int] = None
    capacity: Optional[int] = None
    number: Optional[int] = None

@api.get("/tables")
async def list_tables(user: dict = Depends(get_current_user)):
    return await db.tables.find({"cafe_id": user["cafe_id"]}, {"_id": 0}).sort("number", 1).to_list(500)

@api.post("/tables")
async def create_table(body: TableBody, user: dict = Depends(require_roles("owner", "manager"))):
    doc = {"id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], **body.dict(),
           "guests": 0, "occupied_at": None, "current_order_id": None}
    await db.tables.insert_one(doc)
    return clean(doc)

@api.patch("/tables/{tid}")
async def update_table(tid: str, body: TableUpdate, user: dict = Depends(get_current_user)):
    patch = {k: v for k, v in body.dict().items() if v is not None}
    if body.status == "occupied":
        patch["occupied_at"] = iso(now_utc())
    if body.status == "available":
        patch["occupied_at"] = None
        patch["guests"] = 0
        patch["current_order_id"] = None
    await db.tables.update_one({"id": tid, "cafe_id": user["cafe_id"]}, {"$set": patch})
    return await db.tables.find_one({"id": tid}, {"_id": 0})

@api.delete("/tables/{tid}")
async def delete_table(tid: str, user: dict = Depends(require_roles("owner", "manager"))):
    await db.tables.delete_one({"id": tid, "cafe_id": user["cafe_id"]})
    return {"ok": True}

# ---------- Customers ----------
class CustomerBody(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""

@api.get("/customers")
async def list_customers(user: dict = Depends(get_current_user)):
    return await db.customers.find({"cafe_id": user["cafe_id"]}, {"_id": 0}).to_list(2000)

@api.post("/customers")
async def create_customer(body: CustomerBody, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], **body.dict(),
           "total_orders": 0, "total_spend": 0, "last_order_at": None,
           "created_at": iso(now_utc())}
    await db.customers.insert_one(doc)
    return clean(doc)

@api.patch("/customers/{cid}")
async def update_customer(cid: str, body: CustomerBody, user: dict = Depends(get_current_user)):
    await db.customers.update_one({"id": cid, "cafe_id": user["cafe_id"]}, {"$set": body.dict()})
    return await db.customers.find_one({"id": cid}, {"_id": 0})

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_roles("owner", "manager"))):
    await db.customers.delete_one({"id": cid, "cafe_id": user["cafe_id"]})
    return {"ok": True}

# ---------- Inventory ----------
class InventoryBody(BaseModel):
    name: str
    category: Optional[str] = "General"
    unit: str = "kg"
    current_stock: float = 0
    min_stock: float = 0
    cost: float = 0
    supplier: Optional[str] = ""

class StockTxnBody(BaseModel):
    item_id: str
    qty: float
    type: str  # in | out | adjust
    note: Optional[str] = ""

@api.get("/inventory")
async def list_inventory(user: dict = Depends(get_current_user)):
    return await db.inventory.find({"cafe_id": user["cafe_id"]}, {"_id": 0}).to_list(2000)

@api.post("/inventory")
async def create_inventory(body: InventoryBody, user: dict = Depends(require_roles("owner", "manager"))):
    doc = {"id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], **body.dict()}
    await db.inventory.insert_one(doc)
    return clean(doc)

@api.patch("/inventory/{iid}")
async def update_inventory(iid: str, body: InventoryBody, user: dict = Depends(require_roles("owner", "manager"))):
    await db.inventory.update_one({"id": iid, "cafe_id": user["cafe_id"]}, {"$set": body.dict()})
    return await db.inventory.find_one({"id": iid}, {"_id": 0})

@api.delete("/inventory/{iid}")
async def delete_inventory(iid: str, user: dict = Depends(require_roles("owner", "manager"))):
    await db.inventory.delete_one({"id": iid, "cafe_id": user["cafe_id"]})
    return {"ok": True}

@api.post("/inventory/stock")
async def stock_txn(body: StockTxnBody, user: dict = Depends(require_roles("owner", "manager"))):
    item = await db.inventory.find_one({"id": body.item_id, "cafe_id": user["cafe_id"]})
    if not item:
        raise HTTPException(404, "Item not found")
    delta = body.qty if body.type == "in" else (-body.qty if body.type == "out" else 0)
    new_stock = body.qty if body.type == "adjust" else (item["current_stock"] + delta)
    await db.inventory.update_one({"id": body.item_id, "cafe_id": user["cafe_id"]}, {"$set": {"current_stock": new_stock}})
    await db.stock_txns.insert_one({"id": str(uuid.uuid4()), "cafe_id": user["cafe_id"],
                                    "item_id": body.item_id, "qty": body.qty, "type": body.type,
                                    "note": body.note, "at": iso(now_utc()), "by": user["id"]})
    return {"ok": True, "new_stock": new_stock}

# ---------- Orders ----------
class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    qty: int
    notes: Optional[str] = ""

class OrderPaymentSplit(BaseModel):
    method: str  # cash | upi | card
    amount: float

class OrderBody(BaseModel):
    items: List[OrderItem]
    order_type: str = "dine_in"  # dine_in | takeaway | delivery
    table_id: Optional[str] = None
    customer_id: Optional[str] = None
    discount: float = 0
    tax_rate: float = 5.0
    payment_method: Optional[str] = None  # cash | upi | card | split
    payment_splits: Optional[List[OrderPaymentSplit]] = None
    notes: Optional[str] = ""

class OrderStatusBody(BaseModel):
    status: str  # new | preparing | ready | completed | cancelled
    payment_status: Optional[str] = None  # unpaid | paid

@api.get("/orders")
async def list_orders(user: dict = Depends(get_current_user), status: Optional[str] = None):
    q = {"cafe_id": user["cafe_id"]}
    if status:
        q["status"] = status
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

async def _next_order_no(cafe_id: str) -> int:
    last = await db.orders.find({"cafe_id": cafe_id}, {"_id": 0, "order_no": 1}).sort("order_no", -1).limit(1).to_list(1)
    return (last[0]["order_no"] + 1) if last else 1001

@api.post("/orders")
async def create_order(body: OrderBody, user: dict = Depends(get_current_user)):
    subtotal = sum(i.price * i.qty for i in body.items)
    tax = round((subtotal - body.discount) * body.tax_rate / 100, 2)
    total = round(subtotal - body.discount + tax, 2)
    # Validate splits
    if body.payment_method == "split":
        if not body.payment_splits:
            raise HTTPException(400, "payment_splits required for split payment")
        for s in body.payment_splits:
            if s.method not in ("cash", "upi", "card"):
                raise HTTPException(400, f"Invalid split method: {s.method}")
        split_sum = round(sum(s.amount for s in body.payment_splits), 2)
        if abs(split_sum - total) > 0.02:
            raise HTTPException(400, f"Split amounts ({split_sum}) must equal total ({total})")
    order_no = await _next_order_no(user["cafe_id"])
    doc = {
        "id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], "order_no": order_no,
        "items": [i.dict() for i in body.items],
        "order_type": body.order_type, "table_id": body.table_id,
        "customer_id": body.customer_id, "discount": body.discount,
        "tax_rate": body.tax_rate, "tax": tax, "subtotal": subtotal, "total": total,
        "payment_method": body.payment_method,
        "payment_splits": [s.dict() for s in body.payment_splits] if body.payment_splits else None,
        "payment_status": "paid" if body.payment_method else "unpaid",
        "status": "new", "notes": body.notes,
        "created_at": iso(now_utc()), "created_by": user["id"],
    }
    await db.orders.insert_one(doc)
    if body.table_id:
        await db.tables.update_one({"id": body.table_id, "cafe_id": user["cafe_id"]},
                                   {"$set": {"status": "occupied", "current_order_id": doc["id"],
                                             "occupied_at": iso(now_utc())}})
    if body.customer_id:
        await db.customers.update_one({"id": body.customer_id, "cafe_id": user["cafe_id"]},
                                      {"$inc": {"total_orders": 1, "total_spend": total},
                                       "$set": {"last_order_at": iso(now_utc())}})
    return clean(doc)

@api.patch("/orders/{oid}")
async def update_order_status(oid: str, body: OrderStatusBody, user: dict = Depends(get_current_user)):
    patch = {"status": body.status}
    if body.payment_status:
        patch["payment_status"] = body.payment_status
    await db.orders.update_one({"id": oid, "cafe_id": user["cafe_id"]}, {"$set": patch})
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if order and body.status in ("completed", "cancelled") and order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"], "cafe_id": user["cafe_id"]},
                                   {"$set": {"status": "available", "guests": 0,
                                             "occupied_at": None, "current_order_id": None}})
    return order

@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": oid, "cafe_id": user["cafe_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    return order

# ---------- Staff ----------
class StaffBody(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str  # manager | cashier | kitchen_staff

@api.get("/staff")
async def list_staff(user: dict = Depends(require_roles("owner", "manager"))):
    docs = await db.users.find({"cafe_id": user["cafe_id"]}, {"_id": 0, "password_hash": 0}).to_list(500)
    return docs

@api.post("/staff")
async def create_staff(body: StaffBody, user: dict = Depends(require_roles("owner"))):
    if body.role not in ("manager", "cashier", "kitchen_staff"):
        raise HTTPException(400, "Invalid role")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email exists")
    doc = {"id": str(uuid.uuid4()), "email": email, "name": body.name,
           "password_hash": hash_pw(body.password), "role": body.role,
           "cafe_id": user["cafe_id"], "verified": True,
           "created_at": iso(now_utc())}
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    return clean(doc)

@api.delete("/staff/{sid}")
async def delete_staff(sid: str, user: dict = Depends(require_roles("owner"))):
    if sid == user["id"]:
        raise HTTPException(400, "Cannot delete self")
    await db.users.delete_one({"id": sid, "cafe_id": user["cafe_id"], "role": {"$ne": "owner"}})
    return {"ok": True}

# ---------- Dashboard / Reports ----------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    cafe_id = user["cafe_id"]
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = iso(today_start)
    orders_today = await db.orders.find({"cafe_id": cafe_id, "created_at": {"$gte": today_iso}}, {"_id": 0}).to_list(2000)
    total_sales = sum(o["total"] for o in orders_today if o["status"] != "cancelled")
    orders_count = len([o for o in orders_today if o["status"] != "cancelled"])
    active_tables = await db.tables.count_documents({"cafe_id": cafe_id, "status": "occupied"})
    kitchen_pending = await db.orders.count_documents({"cafe_id": cafe_id, "status": {"$in": ["new", "preparing"]}})
    low_stock = await db.inventory.find({"cafe_id": cafe_id, "$expr": {"$lte": ["$current_stock", "$min_stock"]}}, {"_id": 0}).to_list(50)
    recent = await db.orders.find({"cafe_id": cafe_id}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    # sales by hour today
    by_hour = [0] * 24
    for o in orders_today:
        if o["status"] == "cancelled":
            continue
        try:
            h = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00")).hour
            by_hour[h] += o["total"]
        except Exception:
            pass
    # top products (last 30d)
    since = iso(now_utc() - timedelta(days=30))
    recent_orders = await db.orders.find({"cafe_id": cafe_id, "created_at": {"$gte": since}}, {"_id": 0}).to_list(5000)
    top = {}
    for o in recent_orders:
        for it in o.get("items", []):
            top.setdefault(it["name"], 0)
            top[it["name"]] += it["qty"]
    top_products = sorted([{"name": k, "count": v} for k, v in top.items()], key=lambda x: -x["count"])[:5]
    return {
        "total_sales": total_sales,
        "orders_count": orders_count,
        "active_tables": active_tables,
        "kitchen_pending": kitchen_pending,
        "low_stock": low_stock,
        "recent_orders": recent,
        "sales_by_hour": [{"hour": f"{i:02d}:00", "value": by_hour[i]} for i in range(24)],
        "top_products": top_products,
    }

@api.get("/reports")
async def reports(range: str = "7", user: dict = Depends(get_current_user)):
    days = int(range) if range.isdigit() else 7
    since = now_utc() - timedelta(days=days)
    orders = await db.orders.find({"cafe_id": user["cafe_id"], "created_at": {"$gte": iso(since)}}, {"_id": 0}).to_list(10000)
    active = [o for o in orders if o["status"] != "cancelled"]
    total_sales = sum(o["total"] for o in active)
    total_tax = sum(o.get("tax", 0) for o in active)
    total_discount = sum(o.get("discount", 0) for o in active)
    aov = (total_sales / len(active)) if active else 0
    # daily
    by_day = {}
    for o in active:
        d = o["created_at"][:10]
        by_day.setdefault(d, 0)
        by_day[d] += o["total"]
    daily = sorted([{"date": k, "value": v} for k, v in by_day.items()], key=lambda x: x["date"])
    # payments
    pay = {}
    for o in active:
        m = o.get("payment_method") or "unpaid"
        pay[m] = pay.get(m, 0) + o["total"]
    payments = [{"method": k, "value": v} for k, v in pay.items()]
    # products
    prods = {}
    for o in active:
        for it in o.get("items", []):
            k = it["name"]
            prods.setdefault(k, {"count": 0, "revenue": 0})
            prods[k]["count"] += it["qty"]
            prods[k]["revenue"] += it["qty"] * it["price"]
    top_products = sorted([{"name": k, **v} for k, v in prods.items()], key=lambda x: -x["revenue"])[:10]
    return {"total_sales": total_sales, "total_tax": total_tax, "total_discount": total_discount,
            "orders_count": len(active), "aov": round(aov, 2),
            "daily": daily, "payments": payments, "top_products": top_products}

# ---------- Subscription (Razorpay) ----------
PLANS = {
    "monthly": {"amount": 14900, "days": 30, "label": "Café Plan • Monthly"},
    "yearly":  {"amount": 119900, "days": 365, "label": "Café Plan • Yearly"},
}

class CreateOrderBody(BaseModel):
    plan: str  # monthly | yearly

class VerifyPaymentBody(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str

@api.get("/subscription")
async def get_sub(user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"cafe_id": user["cafe_id"]}, {"_id": 0}, sort=[("started_at", -1)])
    invoices = await db.invoices.find({"cafe_id": user["cafe_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"subscription": sub, "invoices": invoices, "razorpay_key": RAZORPAY_KEY_ID}

@api.post("/subscription/create-order")
async def create_sub_order(body: CreateOrderBody, user: dict = Depends(require_roles("owner"))):
    if body.plan not in PLANS:
        raise HTTPException(400, "Invalid plan")
    if not razor_client:
        raise HTTPException(500, "Razorpay not configured")
    p = PLANS[body.plan]
    receipt = f"sub_{user['cafe_id'][:8]}_{int(now_utc().timestamp())}"[:40]
    order = razor_client.order.create({"amount": p["amount"], "currency": "INR",
                                       "receipt": receipt, "payment_capture": 1,
                                       "notes": {"cafe_id": user["cafe_id"], "plan": body.plan}})
    return {"order_id": order["id"], "amount": order["amount"], "currency": order["currency"],
            "key": RAZORPAY_KEY_ID}

@api.post("/subscription/verify")
async def verify_sub(body: VerifyPaymentBody, user: dict = Depends(require_roles("owner"))):
    if not razor_client:
        raise HTTPException(500, "Razorpay not configured")
    try:
        razor_client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception:
        raise HTTPException(400, "Invalid signature")
    p = PLANS[body.plan]
    sub_id = str(uuid.uuid4())
    now = now_utc()
    await db.subscriptions.insert_one({
        "id": sub_id, "cafe_id": user["cafe_id"], "plan": "cafe",
        "billing_cycle": body.plan, "status": "active",
        "started_at": iso(now), "expires_at": iso(now + timedelta(days=p["days"])),
        "amount": p["amount"] / 100, "payment_id": body.razorpay_payment_id,
    })
    await db.invoices.insert_one({
        "id": str(uuid.uuid4()), "cafe_id": user["cafe_id"], "subscription_id": sub_id,
        "amount": p["amount"] / 100, "label": p["label"],
        "payment_id": body.razorpay_payment_id, "created_at": iso(now),
    })
    return {"ok": True}

app.include_router(api)

# ---------- Public (unauthenticated) — QR ordering ----------
public_api = APIRouter(prefix="/api/public")

@public_api.get("/menu")
async def public_menu(cafe_id: str, table_id: Optional[str] = None):
    cafe = await db.cafes.find_one({"id": cafe_id}, {"_id": 0, "owner_id": 0})
    if not cafe:
        raise HTTPException(404, "Café not found")
    table = None
    if table_id:
        table = await db.tables.find_one({"id": table_id, "cafe_id": cafe_id}, {"_id": 0})
    cats = await db.categories.find({"cafe_id": cafe_id}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    prods = await db.products.find({"cafe_id": cafe_id, "available": {"$ne": False}}, {"_id": 0}).to_list(2000)
    return {"cafe": cafe, "table": table, "categories": cats, "products": prods}

class PublicOrderItem(BaseModel):
    product_id: str
    qty: int
    notes: Optional[str] = ""

class PublicOrderBody(BaseModel):
    cafe_id: str
    table_id: str
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    items: List[PublicOrderItem]
    notes: Optional[str] = ""

@public_api.post("/orders")
async def public_create_order(body: PublicOrderBody):
    cafe = await db.cafes.find_one({"id": body.cafe_id})
    if not cafe:
        raise HTTPException(404, "Café not found")
    table = await db.tables.find_one({"id": body.table_id, "cafe_id": body.cafe_id})
    if not table:
        raise HTTPException(404, "Table not found")
    if not body.items:
        raise HTTPException(400, "Empty order")
    # Resolve product prices from DB (never trust client)
    order_items = []
    subtotal = 0
    for it in body.items:
        p = await db.products.find_one({"id": it.product_id, "cafe_id": body.cafe_id})
        if not p or p.get("available") is False:
            continue
        order_items.append({"product_id": p["id"], "name": p["name"], "price": p["price"], "qty": it.qty, "notes": it.notes or ""})
        subtotal += p["price"] * it.qty
    if not order_items:
        raise HTTPException(400, "No valid items")
    tax_rate = cafe.get("tax_rate", 5)
    tax = round(subtotal * tax_rate / 100, 2)
    total = round(subtotal + tax, 2)
    order_no = await _next_order_no(body.cafe_id)
    doc = {
        "id": str(uuid.uuid4()), "cafe_id": body.cafe_id, "order_no": order_no,
        "items": order_items, "order_type": "dine_in", "table_id": body.table_id,
        "customer_id": None, "discount": 0, "tax_rate": tax_rate, "tax": tax,
        "subtotal": subtotal, "total": total,
        "payment_method": None, "payment_status": "unpaid", "status": "new",
        "notes": (f"[QR order] {body.customer_name or 'Guest'}"
                  f"{' · '+body.customer_phone if body.customer_phone else ''}"
                  f"{' · '+body.notes if body.notes else ''}"),
        "source": "qr", "created_at": iso(now_utc()), "created_by": "guest",
    }
    await db.orders.insert_one(doc)
    await db.tables.update_one({"id": body.table_id, "cafe_id": body.cafe_id},
                               {"$set": {"status": "occupied", "current_order_id": doc["id"],
                                         "occupied_at": iso(now_utc())}})
    clean(doc)
    return {"order_no": order_no, "total": total, "status": "new"}

app.include_router(public_api)

# ---------- Admin panel ----------
admin_api = APIRouter(prefix="/api/admin")

async def get_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    return user

@admin_api.get("/stats")
async def admin_stats(admin: dict = Depends(get_admin)):
    total_cafes = await db.cafes.count_documents({})
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    active_subs = await db.subscriptions.count_documents({"status": "active", "plan": "cafe"})
    trial_subs = await db.subscriptions.count_documents({"status": "active", "plan": "trial"})
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(10000)
    total_revenue = sum(i.get("amount", 0) for i in invoices)
    orders = await db.orders.count_documents({})
    return {"total_cafes": total_cafes, "total_users": total_users,
            "active_subs": active_subs, "trial_subs": trial_subs,
            "total_revenue": total_revenue, "total_orders": orders,
            "invoice_count": len(invoices)}

@admin_api.get("/cafes")
async def admin_cafes(admin: dict = Depends(get_admin)):
    cafes = await db.cafes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    out = []
    for c in cafes:
        owner = await db.users.find_one({"id": c["owner_id"]}, {"_id": 0, "password_hash": 0})
        sub = await db.subscriptions.find_one({"cafe_id": c["id"]}, {"_id": 0}, sort=[("started_at", -1)])
        staff_count = await db.users.count_documents({"cafe_id": c["id"]})
        order_count = await db.orders.count_documents({"cafe_id": c["id"]})
        c["owner"] = owner
        c["subscription"] = sub
        c["staff_count"] = staff_count
        c["order_count"] = order_count
        out.append(c)
    return out

@admin_api.get("/cafes/{cafe_id}")
async def admin_cafe_detail(cafe_id: str, admin: dict = Depends(get_admin)):
    cafe = await db.cafes.find_one({"id": cafe_id}, {"_id": 0})
    if not cafe:
        raise HTTPException(404, "Not found")
    users = await db.users.find({"cafe_id": cafe_id}, {"_id": 0, "password_hash": 0}).to_list(500)
    subs = await db.subscriptions.find({"cafe_id": cafe_id}, {"_id": 0}).sort("started_at", -1).to_list(50)
    invoices = await db.invoices.find({"cafe_id": cafe_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    orders_total = await db.orders.count_documents({"cafe_id": cafe_id})
    return {"cafe": cafe, "users": users, "subscriptions": subs, "invoices": invoices, "orders_total": orders_total}

@admin_api.get("/invoices")
async def admin_invoices(admin: dict = Depends(get_admin)):
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for inv in invoices:
        cafe = await db.cafes.find_one({"id": inv["cafe_id"]}, {"_id": 0, "name": 1})
        inv["cafe_name"] = cafe["name"] if cafe else "—"
    return invoices

app.include_router(admin_api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
