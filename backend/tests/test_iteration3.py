"""NexoraOS Iteration 3 tests: WebSocket KDS, Multi-café Pro plan, Invoice CSV Export."""
import os
import time
import uuid
import json
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
import websockets
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-kitchen-69.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
# WebSocket URL: convert https -> wss, http -> ws
if BASE_URL.startswith("https://"):
    WS_URL = "wss://" + BASE_URL[len("https://"):] + "/api/ws/kds"
else:
    WS_URL = "ws://" + BASE_URL[len("http://"):] + "/api/ws/kds"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nexoraos_db")

ADMIN_EMAIL = "contact@officialdukaan.in"
ADMIN_PASSWORD = "Viral@1979"

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _fetch_otp(email, purpose):
    for _ in range(20):
        rec = db.otps.find_one({"email": email.lower(), "purpose": purpose})
        if rec:
            return rec["otp"]
        time.sleep(0.3)
    return None


def _signup_owner(prefix="own3"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Password123!"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": pw, "name": f"T {prefix}", "cafe_name": f"Cafe {prefix}"
    })
    assert r.status_code == 200, r.text
    otp = _fetch_otp(email, "signup")
    assert otp, "OTP not found"
    r2 = requests.post(f"{API}/auth/verify-otp", json={"email": email, "otp": otp})
    assert r2.status_code == 200, r2.text
    d = r2.json()
    return {"email": email, "password": pw, "token": d["token"], "user": d["user"]}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_a():
    return _signup_owner("A")


@pytest.fixture(scope="module")
def owner_b():
    return _signup_owner("B")


# ---------- Helpers to drain WS ----------
async def _recv_json(ws, timeout=5.0):
    try:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        return json.loads(raw)
    except asyncio.TimeoutError:
        return None


async def _drain(ws, seconds=0.8):
    """Non-blocking drain of any queued messages."""
    end = time.monotonic() + seconds
    msgs = []
    while time.monotonic() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=0.15)
            msgs.append(json.loads(raw))
        except asyncio.TimeoutError:
            continue
        except Exception:
            break
    return msgs


# ============ WebSocket auth ============
class TestWSAuth:
    def test_ws_invalid_token_closes(self):
        async def run():
            try:
                async with websockets.connect(f"{WS_URL}?token=invalid.jwt.here", open_timeout=10) as ws:
                    # Server should close with 4401 during/after accept
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=5)
                    except Exception:
                        pass
                    return getattr(ws, "close_code", None)
            except websockets.exceptions.InvalidStatus as e:
                # Handshake rejected (also acceptable — 401/403)
                return e.response.status_code
            except websockets.exceptions.ConnectionClosed as e:
                return e.code
        code = asyncio.run(run())
        # Accept 4401 (custom), or any 4xxx / handshake rejection
        assert code in (4401, 401, 403) or (isinstance(code, int) and code >= 4000), f"Got close code: {code}"

    def test_ws_missing_token_rejected(self):
        async def run():
            try:
                async with websockets.connect(WS_URL, open_timeout=10) as ws:
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=3)
                    except Exception:
                        pass
                    return getattr(ws, "close_code", None)
            except websockets.exceptions.InvalidStatus as e:
                return e.response.status_code
            except websockets.exceptions.ConnectionClosed as e:
                return e.code
            except Exception as e:
                return f"err:{e}"
        code = asyncio.run(run())
        # FastAPI returns 403 during handshake when required query is missing
        assert code in (403, 422, 4401) or (isinstance(code, int) and code >= 400), f"Got: {code}"

    def test_ws_valid_token_connects(self, owner_a):
        async def run():
            async with websockets.connect(f"{WS_URL}?token={owner_a['token']}", open_timeout=10) as ws:
                await ws.send("ping")
                msg = await _recv_json(ws, timeout=5)
                return msg
        msg = asyncio.run(run())
        assert msg == {"type": "pong"}, f"Got: {msg}"


# ============ WebSocket broadcasts ============
class TestWSBroadcasts:
    def test_broadcast_order_new_and_tenant_isolation(self, owner_a, owner_b):
        """Owner A creates an order; A's client gets it, B's client does NOT."""
        async def run():
            async with websockets.connect(f"{WS_URL}?token={owner_a['token']}", open_timeout=10) as ws_a, \
                       websockets.connect(f"{WS_URL}?token={owner_b['token']}", open_timeout=10) as ws_b:
                # Give the server a moment to register both connections
                await asyncio.sleep(0.5)
                # Trigger order creation via REST (do it in a thread since requests is sync)
                loop = asyncio.get_event_loop()
                def _post():
                    return requests.post(f"{API}/orders", headers=_h(owner_a["token"]), json={
                        "items": [{"product_id": "p1", "name": "Test", "price": 100, "qty": 1}],
                        "order_type": "takeaway", "tax_rate": 5,
                    })
                resp = await loop.run_in_executor(None, _post)
                assert resp.status_code == 200, resp.text
                created = resp.json()
                # Receive on A
                msg_a = await _recv_json(ws_a, timeout=5)
                # Drain B briefly
                msgs_b = await _drain(ws_b, seconds=1.0)
                return created, msg_a, msgs_b
        created, msg_a, msgs_b = asyncio.run(run())
        assert msg_a is not None, "Owner A did not receive broadcast"
        assert msg_a.get("type") == "order.new"
        assert msg_a.get("id") == created["id"]
        assert msg_a.get("order_no") == created["order_no"]
        assert not any(m.get("id") == created["id"] for m in msgs_b), \
            f"Tenant isolation broken: owner B received {msgs_b}"
        # Save for downstream test
        pytest.shared_order = created

    def test_broadcast_order_updated(self, owner_a):
        order = getattr(pytest, "shared_order", None)
        if not order:
            pytest.skip("prior test failed")
        async def run():
            async with websockets.connect(f"{WS_URL}?token={owner_a['token']}", open_timeout=10) as ws_a:
                await asyncio.sleep(0.4)
                loop = asyncio.get_event_loop()
                def _patch():
                    return requests.patch(f"{API}/orders/{order['id']}", headers=_h(owner_a["token"]),
                                          json={"status": "preparing"})
                resp = await loop.run_in_executor(None, _patch)
                assert resp.status_code == 200, resp.text
                # Might receive multiple messages if order.new is queued from a prior connect;
                # scan up to 3 messages for the update.
                for _ in range(3):
                    msg = await _recv_json(ws_a, timeout=5)
                    if msg and msg.get("type") == "order.updated" and msg.get("id") == order["id"]:
                        return msg
                return None
        msg = asyncio.run(run())
        assert msg is not None, "Did not receive order.updated"
        assert msg["status"] == "preparing"

    def test_broadcast_public_qr_order(self, owner_a):
        """Public QR order should broadcast type=order.new, source=qr to owner-A room."""
        # Prepare: create a category, product, table under owner A
        h = _h(owner_a["token"])
        cat = requests.post(f"{API}/categories", headers=h, json={"name": "TEST_qr_cat"}).json()
        prod = requests.post(f"{API}/products", headers=h, json={
            "name": "TEST_qr_prod", "category_id": cat["id"], "price": 50, "tax_rate": 5
        }).json()
        tbl = requests.post(f"{API}/tables", headers=h, json={"number": 991, "capacity": 4}).json()
        cafe_id = owner_a["user"]["cafe_id"]

        async def run():
            async with websockets.connect(f"{WS_URL}?token={owner_a['token']}", open_timeout=10) as ws:
                await asyncio.sleep(0.4)
                loop = asyncio.get_event_loop()
                def _post():
                    return requests.post(f"{API}/public/orders", json={
                        "cafe_id": cafe_id, "table_id": tbl["id"],
                        "customer_name": "TEST QR",
                        "items": [{"product_id": prod["id"], "qty": 2}],
                    })
                resp = await loop.run_in_executor(None, _post)
                assert resp.status_code == 200, resp.text
                for _ in range(4):
                    msg = await _recv_json(ws, timeout=5)
                    if msg and msg.get("source") == "qr":
                        return msg
                return None
        msg = asyncio.run(run())
        assert msg is not None, "Did not receive QR broadcast"
        assert msg["type"] == "order.new"
        assert msg["source"] == "qr"


# ============ Multi-café ============
class TestMultiCafe:
    def test_cafes_mine_trial_defaults(self):
        owner = _signup_owner("mc1")
        r = requests.get(f"{API}/cafes/mine", headers=_h(owner["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["max_cafes"] == 1
        assert d["is_pro"] is False
        assert len(d["cafes"]) == 1
        assert d["current_id"] == owner["user"]["cafe_id"]

    def test_create_second_cafe_blocked_on_trial(self):
        owner = _signup_owner("mc2")
        r = requests.post(f"{API}/cafes", headers=_h(owner["token"]), json={"name": "TEST_Second"})
        assert r.status_code == 400
        assert "limit" in r.json().get("detail", "").lower()

    def test_pro_plan_allows_up_to_3_cafes(self):
        owner = _signup_owner("mc3")
        # Simulate a purchased Pro subscription for owner's café
        db.subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "cafe_id": owner["user"]["cafe_id"],
            "plan": "pro", "billing_cycle": "pro_monthly", "status": "active",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "amount": 299, "payment_id": "TEST_pay",
        })
        # /cafes/mine should reflect Pro
        r = requests.get(f"{API}/cafes/mine", headers=_h(owner["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["is_pro"] is True
        assert d["max_cafes"] == 3
        # Create second café
        r2 = requests.post(f"{API}/cafes", headers=_h(owner["token"]), json={"name": "TEST_Second_Pro"})
        assert r2.status_code == 200, r2.text
        # Confirm listing
        r3 = requests.get(f"{API}/cafes/mine", headers=_h(owner["token"]))
        cafes = r3.json()["cafes"]
        assert len(cafes) == 2
        names = [c["name"] for c in cafes]
        assert "TEST_Second_Pro" in names
        pytest.mc3_owner = owner
        pytest.mc3_second_id = r2.json()["id"]

    def test_switch_cafe_and_isolation(self):
        owner = getattr(pytest, "mc3_owner", None) or _signup_owner("mc4")
        second_id = getattr(pytest, "mc3_second_id", None)
        if not second_id:
            # ensure pro
            db.subscriptions.insert_one({
                "id": str(uuid.uuid4()), "cafe_id": owner["user"]["cafe_id"],
                "plan": "pro", "billing_cycle": "pro_monthly", "status": "active",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "amount": 299, "payment_id": "TEST",
            })
            r2 = requests.post(f"{API}/cafes", headers=_h(owner["token"]), json={"name": "TEST_Second_Switch"})
            second_id = r2.json()["id"]

        # Add a product to the FIRST café using existing token
        h1 = _h(owner["token"])
        cat = requests.post(f"{API}/categories", headers=h1, json={"name": "TEST_first"}).json()
        requests.post(f"{API}/products", headers=h1, json={
            "name": "TEST_prod_first", "category_id": cat["id"], "price": 10, "tax_rate": 5
        })

        # Switch to second café
        r = requests.post(f"{API}/cafes/switch", headers=_h(owner["token"]), json={"cafe_id": second_id})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["cafe_id"] == second_id
        new_token = d["token"]

        # JWT claim must be new café
        import jwt as pyjwt
        decoded = pyjwt.decode(new_token, options={"verify_signature": False})
        assert decoded["cafe_id"] == second_id

        # Products under new token should NOT include the first café's product
        h2 = _h(new_token)
        prods = requests.get(f"{API}/products", headers=h2).json()
        assert all(p["name"] != "TEST_prod_first" for p in prods), \
            "Tenant isolation broken after switch"

    def test_switch_to_unowned_cafe_returns_404(self, owner_a, owner_b):
        # owner_a tries to switch to owner_b's café
        r = requests.post(f"{API}/cafes/switch", headers=_h(owner_a["token"]),
                          json={"cafe_id": owner_b["user"]["cafe_id"]})
        assert r.status_code == 404

    def test_non_owner_cannot_create_cafe(self, owner_a):
        # Create cashier under owner A
        cashier_email = f"TEST_cash_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/staff", headers=_h(owner_a["token"]), json={
            "name": "Cashier", "email": cashier_email, "password": "Cash1234!", "role": "cashier"
        })
        assert r.status_code == 200, r.text
        # Login as cashier
        r2 = requests.post(f"{API}/auth/login", json={"email": cashier_email, "password": "Cash1234!"})
        assert r2.status_code == 200
        ctoken = r2.json()["token"]
        r3 = requests.post(f"{API}/cafes", headers=_h(ctoken), json={"name": "TEST_Nope"})
        assert r3.status_code == 403


# ============ Pro plan Razorpay ============
class TestProSubscription:
    def test_pro_monthly_amount(self, owner_a):
        r = requests.post(f"{API}/subscription/create-order", headers=_h(owner_a["token"]),
                          json={"plan": "pro_monthly"})
        # Requires Razorpay configured; if not, endpoint returns 500.
        if r.status_code == 500 and "razorpay" in r.text.lower():
            pytest.skip("Razorpay not configured in test env")
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 29900

    def test_pro_yearly_amount(self, owner_a):
        r = requests.post(f"{API}/subscription/create-order", headers=_h(owner_a["token"]),
                          json={"plan": "pro_yearly"})
        if r.status_code == 500 and "razorpay" in r.text.lower():
            pytest.skip("Razorpay not configured in test env")
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 249900

    def test_invalid_plan(self, owner_a):
        r = requests.post(f"{API}/subscription/create-order", headers=_h(owner_a["token"]),
                          json={"plan": "bogus"})
        assert r.status_code == 400

    def test_admin_cannot_create_order(self, admin_token):
        r = requests.post(f"{API}/subscription/create-order", headers=_h(admin_token),
                          json={"plan": "pro_monthly"})
        assert r.status_code == 403


# ============ Admin CSV export ============
class TestAdminInvoicesExport:
    def test_admin_export_returns_csv(self, admin_token):
        r = requests.get(f"{API}/admin/invoices/export", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype, f"content-type={ctype}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        first_line = r.text.splitlines()[0] if r.text else ""
        expected = "Invoice ID,Date,Café,Café ID,Plan,Amount (INR),Razorpay Payment ID,Subscription ID"
        assert first_line == expected, f"Got header: {first_line!r}"

    def test_non_admin_forbidden(self, owner_a):
        r = requests.get(f"{API}/admin/invoices/export", headers=_h(owner_a["token"]))
        assert r.status_code == 403
