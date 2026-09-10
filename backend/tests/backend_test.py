"""NexoraOS Backend API tests"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-kitchen-69.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nexoraos_db")

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


def _fetch_otp(email, purpose):
    for _ in range(10):
        rec = db.otps.find_one({"email": email.lower(), "purpose": purpose})
        if rec:
            return rec["otp"]
        time.sleep(0.3)
    return None


def _signup_owner(prefix="ownerA"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Password123!"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": pw, "name": f"Test {prefix}",
        "cafe_name": f"Cafe {prefix}"
    })
    assert r.status_code == 200, r.text
    otp = _fetch_otp(email, "signup")
    assert otp, f"No OTP found for {email}"
    r2 = requests.post(f"{API}/auth/verify-otp", json={"email": email, "otp": otp})
    assert r2.status_code == 200, r2.text
    data = r2.json()
    return {"email": email, "password": pw, "token": data["token"], "user": data["user"]}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner_a():
    return _signup_owner("ownerA")


@pytest.fixture(scope="module")
def owner_b():
    return _signup_owner("ownerB")


# ---------- Auth ----------
class TestAuth:
    def test_signup_and_verify_creates_user_cafe_trial(self, owner_a):
        assert owner_a["token"]
        assert owner_a["user"]["role"] == "owner"
        assert owner_a["user"]["cafe_id"]
        sub = db.subscriptions.find_one({"cafe_id": owner_a["user"]["cafe_id"]})
        assert sub and sub["plan"] == "trial" and sub["status"] == "active"

    def test_signup_duplicate_email_rejected(self, owner_a):
        r = requests.post(f"{API}/auth/signup", json={
            "email": owner_a["email"], "password": "Password123!",
            "name": "x", "cafe_name": "x"
        })
        assert r.status_code == 400

    def test_login_success(self, owner_a):
        r = requests.post(f"{API}/auth/login", json={"email": owner_a["email"], "password": owner_a["password"]})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, owner_a):
        r = requests.post(f"{API}/auth/login", json={"email": owner_a["email"], "password": "WrongPassword!"})
        assert r.status_code == 401

    def test_me(self, owner_a):
        r = requests.get(f"{API}/auth/me", headers=_h(owner_a["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == owner_a["email"].lower()
        assert data["cafe"]["id"] == owner_a["user"]["cafe_id"]

    def test_forgot_and_reset_password(self, owner_a):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": owner_a["email"]})
        assert r.status_code == 200
        otp = _fetch_otp(owner_a["email"], "reset")
        assert otp
        new_pw = "NewPassword123!"
        r2 = requests.post(f"{API}/auth/reset-password", json={
            "email": owner_a["email"], "otp": otp, "new_password": new_pw
        })
        assert r2.status_code == 200
        # login with new
        r3 = requests.post(f"{API}/auth/login", json={"email": owner_a["email"], "password": new_pw})
        assert r3.status_code == 200
        # restore original
        r4 = requests.post(f"{API}/auth/forgot-password", json={"email": owner_a["email"]})
        assert r4.status_code == 200
        otp2 = _fetch_otp(owner_a["email"], "reset")
        r5 = requests.post(f"{API}/auth/reset-password", json={
            "email": owner_a["email"], "otp": otp2, "new_password": owner_a["password"]
        })
        assert r5.status_code == 200

    def test_forgot_unregistered_email_generic_response(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "TEST_nonexistent_zzz@example.com"})
        assert r.status_code == 200
        assert "OTP has been sent" in r.json().get("message", "")


# ---------- Categories/Products/Tables/Customers/Inventory ----------
class TestCRUD:
    def test_categories(self, owner_a):
        r = requests.post(f"{API}/categories", headers=_h(owner_a["token"]),
                          json={"name": "TEST_Coffee", "sort_order": 1})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        r2 = requests.get(f"{API}/categories", headers=_h(owner_a["token"]))
        assert any(c["id"] == cid for c in r2.json())
        r3 = requests.patch(f"{API}/categories/{cid}", headers=_h(owner_a["token"]),
                            json={"name": "TEST_Coffee2", "sort_order": 2})
        assert r3.status_code == 200 and r3.json()["name"] == "TEST_Coffee2"
        owner_a["_cat_id"] = cid

    def test_products(self, owner_a):
        cat_id = owner_a["_cat_id"]
        r = requests.post(f"{API}/products", headers=_h(owner_a["token"]),
                          json={"name": "TEST_Latte", "category_id": cat_id, "price": 150.0,
                                "tax_rate": 5.0, "prep_time": 5, "available": True})
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["price"] == 150.0
        owner_a["_prod_id"] = pid
        owner_a["_prod_name"] = "TEST_Latte"
        owner_a["_prod_price"] = 150.0

    def test_tables(self, owner_a):
        r = requests.post(f"{API}/tables", headers=_h(owner_a["token"]),
                          json={"number": 1, "capacity": 4})
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        # status change to reserved
        r2 = requests.patch(f"{API}/tables/{tid}", headers=_h(owner_a["token"]),
                            json={"status": "reserved"})
        assert r2.status_code == 200 and r2.json()["status"] == "reserved"
        # back to available
        requests.patch(f"{API}/tables/{tid}", headers=_h(owner_a["token"]), json={"status": "available"})
        owner_a["_table_id"] = tid

    def test_customers(self, owner_a):
        r = requests.post(f"{API}/customers", headers=_h(owner_a["token"]),
                          json={"name": "TEST_Cust", "phone": "9999900000"})
        assert r.status_code == 200
        cust_id = r.json()["id"]
        assert r.json()["total_orders"] == 0
        owner_a["_cust_id"] = cust_id

    def test_inventory_and_stock(self, owner_a):
        r = requests.post(f"{API}/inventory", headers=_h(owner_a["token"]),
                          json={"name": "TEST_Milk", "unit": "L", "current_stock": 10,
                                "min_stock": 5, "cost": 60})
        assert r.status_code == 200
        iid = r.json()["id"]
        # in +5 -> 15
        r2 = requests.post(f"{API}/inventory/stock", headers=_h(owner_a["token"]),
                           json={"item_id": iid, "qty": 5, "type": "in"})
        assert r2.status_code == 200 and r2.json()["new_stock"] == 15
        # out 3 -> 12
        r3 = requests.post(f"{API}/inventory/stock", headers=_h(owner_a["token"]),
                           json={"item_id": iid, "qty": 3, "type": "out"})
        assert r3.json()["new_stock"] == 12
        # adjust 20 -> 20
        r4 = requests.post(f"{API}/inventory/stock", headers=_h(owner_a["token"]),
                           json={"item_id": iid, "qty": 20, "type": "adjust"})
        assert r4.json()["new_stock"] == 20
        owner_a["_inv_id"] = iid


# ---------- Orders ----------
class TestOrders:
    def test_create_order_and_totals(self, owner_a):
        pid = owner_a["_prod_id"]
        tid = owner_a["_table_id"]
        cust_id = owner_a["_cust_id"]
        body = {
            "items": [{"product_id": pid, "name": "TEST_Latte", "price": 150.0, "qty": 2}],
            "order_type": "dine_in", "table_id": tid, "customer_id": cust_id,
            "discount": 0, "tax_rate": 5.0, "payment_method": "cash"
        }
        r = requests.post(f"{API}/orders", headers=_h(owner_a["token"]), json=body)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["subtotal"] == 300.0
        assert o["tax"] == 15.0
        assert o["total"] == 315.0
        assert o["order_no"] == 1001
        assert o["status"] == "new"
        assert o["payment_status"] == "paid"
        owner_a["_order_id"] = o["id"]
        # table occupied
        tables = requests.get(f"{API}/tables", headers=_h(owner_a["token"])).json()
        t = next(t for t in tables if t["id"] == tid)
        assert t["status"] == "occupied"
        # customer updated
        custs = requests.get(f"{API}/customers", headers=_h(owner_a["token"])).json()
        c = next(c for c in custs if c["id"] == cust_id)
        assert c["total_orders"] == 1
        assert c["total_spend"] == 315.0

    def test_order_no_sequential(self, owner_a):
        pid = owner_a["_prod_id"]
        r = requests.post(f"{API}/orders", headers=_h(owner_a["token"]), json={
            "items": [{"product_id": pid, "name": "TEST_Latte", "price": 150.0, "qty": 1}],
            "order_type": "takeaway", "tax_rate": 5.0
        })
        assert r.json()["order_no"] == 1002

    def test_order_status_flow_frees_table(self, owner_a):
        oid = owner_a["_order_id"]
        tid = owner_a["_table_id"]
        for s in ["preparing", "ready", "completed"]:
            r = requests.patch(f"{API}/orders/{oid}", headers=_h(owner_a["token"]), json={"status": s})
            assert r.status_code == 200
            assert r.json()["status"] == s
        tables = requests.get(f"{API}/tables", headers=_h(owner_a["token"])).json()
        t = next(t for t in tables if t["id"] == tid)
        assert t["status"] == "available"


# ---------- Tenant Isolation ----------
class TestTenantIsolation:
    def test_owner_b_sees_no_owner_a_data(self, owner_a, owner_b):
        for path in ["/products", "/categories", "/tables", "/customers", "/inventory", "/orders"]:
            r = requests.get(f"{API}{path}", headers=_h(owner_b["token"]))
            assert r.status_code == 200
            data = r.json()
            # Owner B just signed up - should be empty
            assert isinstance(data, list)
            for item in data:
                assert item.get("cafe_id") == owner_b["user"]["cafe_id"], f"Tenant leak on {path}"

    def test_owner_b_order_no_starts_1001(self, owner_b):
        # Create a category+product+order under owner_b to check independent sequence
        cat = requests.post(f"{API}/categories", headers=_h(owner_b["token"]),
                            json={"name": "TEST_B_Cat"}).json()
        prod = requests.post(f"{API}/products", headers=_h(owner_b["token"]),
                             json={"name": "TEST_B_Prod", "category_id": cat["id"],
                                   "price": 100.0}).json()
        r = requests.post(f"{API}/orders", headers=_h(owner_b["token"]), json={
            "items": [{"product_id": prod["id"], "name": "TEST_B_Prod", "price": 100.0, "qty": 1}],
            "order_type": "takeaway", "tax_rate": 5.0
        })
        assert r.status_code == 200
        assert r.json()["order_no"] == 1001


# ---------- Dashboard/Reports ----------
class TestDashboardReports:
    def test_dashboard(self, owner_a):
        r = requests.get(f"{API}/dashboard", headers=_h(owner_a["token"]))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_sales", "orders_count", "active_tables", "kitchen_pending",
                  "low_stock", "recent_orders", "sales_by_hour", "top_products"]:
            assert k in d, f"missing {k}"
        assert len(d["sales_by_hour"]) == 24

    def test_reports(self, owner_a):
        r = requests.get(f"{API}/reports?range=7", headers=_h(owner_a["token"]))
        assert r.status_code == 200
        rep = r.json()
        for k in ["total_sales", "total_tax", "total_discount", "orders_count",
                  "aov", "daily", "payments", "top_products"]:
            assert k in rep


# ---------- Staff / RBAC ----------
class TestStaffRBAC:
    def test_create_staff_and_login(self, owner_a):
        email = f"TEST_cashier_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/staff", headers=_h(owner_a["token"]),
                          json={"name": "Cashier", "email": email,
                                "password": "Cashier123!", "role": "cashier"})
        assert r.status_code == 200, r.text
        # login
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Cashier123!"})
        assert r2.status_code == 200
        cashier_token = r2.json()["token"]
        # me returns same cafe
        me = requests.get(f"{API}/auth/me", headers=_h(cashier_token)).json()
        assert me["user"]["cafe_id"] == owner_a["user"]["cafe_id"]
        # cashier cannot create category
        r3 = requests.post(f"{API}/categories", headers=_h(cashier_token), json={"name": "X"})
        assert r3.status_code == 403
        # cashier cannot create staff
        r4 = requests.post(f"{API}/staff", headers=_h(cashier_token),
                           json={"name": "y", "email": "y@y.com", "password": "abcdef", "role": "cashier"})
        assert r4.status_code == 403
        owner_a["_cashier_id"] = r.json()["id"]
        owner_a["_cashier_token"] = cashier_token

    def test_list_staff(self, owner_a):
        r = requests.get(f"{API}/staff", headers=_h(owner_a["token"]))
        assert r.status_code == 200
        assert any(s["id"] == owner_a["_cashier_id"] for s in r.json())

    def test_delete_staff(self, owner_a):
        r = requests.delete(f"{API}/staff/{owner_a['_cashier_id']}", headers=_h(owner_a["token"]))
        assert r.status_code == 200

    def test_kitchen_cannot_write_menu(self, owner_a):
        email = f"TEST_kitchen_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/staff", headers=_h(owner_a["token"]),
                          json={"name": "Kitchen", "email": email,
                                "password": "Kitchen123!", "role": "kitchen_staff"})
        assert r.status_code == 200
        tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "Kitchen123!"}).json()["token"]
        r2 = requests.post(f"{API}/products", headers=_h(tok),
                           json={"name": "X", "category_id": "x", "price": 1})
        assert r2.status_code == 403
        r3 = requests.post(f"{API}/categories", headers=_h(tok), json={"name": "X"})
        assert r3.status_code == 403


# ---------- Subscription ----------
class TestSubscription:
    def test_get_subscription(self, owner_a):
        r = requests.get(f"{API}/subscription", headers=_h(owner_a["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "subscription" in d and "invoices" in d and "razorpay_key" in d
        assert d["subscription"]["plan"] == "trial"

    def test_create_order_monthly(self, owner_a):
        r = requests.post(f"{API}/subscription/create-order",
                          headers=_h(owner_a["token"]), json={"plan": "monthly"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "order_id" in d and d["amount"] == 14900 and d["key"]

    def test_create_order_yearly(self, owner_a):
        r = requests.post(f"{API}/subscription/create-order",
                          headers=_h(owner_a["token"]), json={"plan": "yearly"})
        assert r.status_code == 200
        assert r.json()["amount"] == 119900

    def test_non_owner_cannot_create_order(self, owner_a):
        # Create manager
        email = f"TEST_mgr_{uuid.uuid4().hex[:6]}@example.com"
        requests.post(f"{API}/staff", headers=_h(owner_a["token"]),
                      json={"name": "Mgr", "email": email,
                            "password": "Manager123!", "role": "manager"})
        tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "Manager123!"}).json()["token"]
        r = requests.post(f"{API}/subscription/create-order",
                         headers=_h(tok), json={"plan": "monthly"})
        assert r.status_code == 403


# ---------- Cafe update ----------
class TestCafeUpdate:
    def test_patch_cafe(self, owner_a):
        r = requests.patch(f"{API}/cafe", headers=_h(owner_a["token"]),
                           json={"name": "TEST_Updated Cafe", "tax_rate": 12.0, "gstin": "22AAAAA0000A1Z5"})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Updated Cafe"
        assert d["tax_rate"] == 12.0
