"""NexoraOS Iteration 2 tests: admin panel, Google auth, public QR ordering, split payments."""
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

ADMIN_EMAIL = "contact@officialdukaan.in"
ADMIN_PASSWORD = "Viral@1979"

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _fetch_otp(email, purpose):
    for _ in range(15):
        rec = db.otps.find_one({"email": email.lower(), "purpose": purpose})
        if rec:
            return rec["otp"]
        time.sleep(0.3)
    return None


def _signup_owner(prefix="own2"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Password123!"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": pw, "name": f"T {prefix}", "cafe_name": f"Cafe {prefix}"
    })
    assert r.status_code == 200, r.text
    otp = _fetch_otp(email, "signup")
    r2 = requests.post(f"{API}/auth/verify-otp", json={"email": email, "otp": otp})
    assert r2.status_code == 200
    d = r2.json()
    return {"email": email, "password": pw, "token": d["token"], "user": d["user"]}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["role"] == "admin"
    assert d["user"]["cafe_id"] in (None, "")
    return d["token"]


@pytest.fixture(scope="module")
def owner():
    return _signup_owner("own2")


# ------- Admin Auth -------
class TestAdminAuth:
    def test_admin_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert "token" in d

    def test_admin_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPass!"})
        assert r.status_code == 401

    def test_regular_signup_cannot_get_admin_role(self, owner):
        assert owner["user"]["role"] == "owner"
        # DB check: role for that user is owner
        u = db.users.find_one({"email": owner["email"].lower()})
        assert u is not None
        assert u["role"] == "owner"


# ------- Admin RBAC -------
class TestAdminRBAC:
    def test_owner_forbidden_on_admin_endpoints(self, owner):
        for path in ["/admin/stats", "/admin/cafes", "/admin/invoices",
                     f"/admin/cafes/{owner['user']['cafe_id']}"]:
            r = requests.get(f"{API}{path}", headers=_h(owner["token"]))
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_no_token_401(self):
        for path in ["/admin/stats", "/admin/cafes", "/admin/invoices"]:
            r = requests.get(f"{API}{path}")
            assert r.status_code in (401, 403)


# ------- Admin Stats -------
class TestAdminStats:
    def test_stats_shape_numeric(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_cafes", "total_users", "active_subs", "trial_subs",
                  "total_revenue", "total_orders", "invoice_count"]:
            assert k in d, f"missing {k}"
            assert isinstance(d[k], (int, float)), f"{k} not numeric: {type(d[k])}"


# ------- Admin Cafes -------
class TestAdminCafes:
    def test_list_cafes_includes_new_owner(self, admin_token, owner):
        r = requests.get(f"{API}/admin/cafes", headers=_h(admin_token))
        assert r.status_code == 200
        cafes = r.json()
        assert isinstance(cafes, list) and len(cafes) > 0
        match = next((c for c in cafes if c["id"] == owner["user"]["cafe_id"]), None)
        assert match, "new cafe not in admin list"
        assert "owner" in match and match["owner"]["email"] == owner["email"].lower()
        assert "subscription" in match and match["subscription"]["plan"] == "trial"
        assert "staff_count" in match and isinstance(match["staff_count"], int)
        assert "order_count" in match and isinstance(match["order_count"], int)

    def test_cafe_detail(self, admin_token, owner):
        cid = owner["user"]["cafe_id"]
        r = requests.get(f"{API}/admin/cafes/{cid}", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["cafe", "users", "subscriptions", "invoices", "orders_total"]:
            assert k in d
        assert d["cafe"]["id"] == cid
        assert isinstance(d["users"], list)
        assert any(u["email"] == owner["email"].lower() for u in d["users"])
        assert isinstance(d["orders_total"], int)

    def test_cafe_detail_404(self, admin_token):
        r = requests.get(f"{API}/admin/cafes/nonexistent-xxx", headers=_h(admin_token))
        assert r.status_code == 404


# ------- Admin Invoices -------
class TestAdminInvoices:
    def test_invoices_list(self, admin_token):
        r = requests.get(f"{API}/admin/invoices", headers=_h(admin_token))
        assert r.status_code == 200
        invs = r.json()
        assert isinstance(invs, list)
        for inv in invs:
            assert "cafe_name" in inv


# ------- Google Auth -------
class TestGoogleAuth:
    def test_google_invalid_credential_401(self):
        r = requests.post(f"{API}/auth/google", json={"credential": "not-a-real-google-jwt"})
        assert r.status_code == 401, r.text

    def test_google_malformed_missing_credential(self):
        r = requests.post(f"{API}/auth/google", json={})
        assert r.status_code in (400, 422)


# ------- Public Menu -------
@pytest.fixture(scope="module")
def owner_with_menu(owner):
    # add category, product, and table for public tests
    cat = requests.post(f"{API}/categories", headers=_h(owner["token"]),
                        json={"name": "TEST_QRCat", "sort_order": 1}).json()
    prod_avail = requests.post(f"{API}/products", headers=_h(owner["token"]),
                               json={"name": "TEST_QRProd", "category_id": cat["id"],
                                     "price": 200.0, "tax_rate": 5.0, "available": True}).json()
    prod_unavail = requests.post(f"{API}/products", headers=_h(owner["token"]),
                                 json={"name": "TEST_QRProdHidden", "category_id": cat["id"],
                                       "price": 99.0, "available": False}).json()
    tbl = requests.post(f"{API}/tables", headers=_h(owner["token"]),
                        json={"number": 42, "capacity": 4}).json()
    return {**owner, "cat": cat, "prod": prod_avail, "hidden": prod_unavail, "table": tbl}


class TestPublicMenu:
    def test_public_menu_no_auth(self, owner_with_menu):
        cid = owner_with_menu["user"]["cafe_id"]
        tid = owner_with_menu["table"]["id"]
        r = requests.get(f"{API}/public/menu", params={"cafe_id": cid, "table_id": tid})
        assert r.status_code == 200
        d = r.json()
        for k in ["cafe", "table", "categories", "products"]:
            assert k in d
        assert d["cafe"]["id"] == cid
        assert d["table"] and d["table"]["id"] == tid
        # available filter
        prod_ids = [p["id"] for p in d["products"]]
        assert owner_with_menu["prod"]["id"] in prod_ids
        assert owner_with_menu["hidden"]["id"] not in prod_ids

    def test_public_menu_invalid_cafe_404(self):
        r = requests.get(f"{API}/public/menu", params={"cafe_id": "nope-xxx"})
        assert r.status_code == 404

    def test_public_menu_without_table(self, owner_with_menu):
        cid = owner_with_menu["user"]["cafe_id"]
        r = requests.get(f"{API}/public/menu", params={"cafe_id": cid})
        assert r.status_code == 200
        assert r.json()["table"] is None


class TestPublicOrder:
    def test_create_public_order_no_auth(self, owner_with_menu):
        cid = owner_with_menu["user"]["cafe_id"]
        tid = owner_with_menu["table"]["id"]
        pid = owner_with_menu["prod"]["id"]
        # client-supplied inflated price should be ignored (server uses DB price)
        r = requests.post(f"{API}/public/orders", json={
            "cafe_id": cid, "table_id": tid,
            "items": [{"product_id": pid, "qty": 2, "notes": ""}],
            "customer_name": "TEST_Guest", "customer_phone": "9999999999",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        # 200 * 2 = 400 subtotal + 5% tax = 20 -> total 420
        assert d["total"] == 420.0
        assert d["status"] == "new"
        assert "order_no" in d
        # DB verify: source=qr, table occupied
        order = db.orders.find_one({"cafe_id": cid, "order_no": d["order_no"]})
        assert order["source"] == "qr"
        assert order["status"] == "new"
        assert order["items"][0]["price"] == 200.0  # server-side price
        # table should be occupied
        tbl = db.tables.find_one({"id": tid, "cafe_id": cid})
        assert tbl["status"] == "occupied"

    def test_public_order_invalid_cafe_404(self, owner_with_menu):
        r = requests.post(f"{API}/public/orders", json={
            "cafe_id": "nope", "table_id": owner_with_menu["table"]["id"],
            "items": [{"product_id": owner_with_menu["prod"]["id"], "qty": 1}],
        })
        assert r.status_code == 404

    def test_public_order_invalid_table_404(self, owner_with_menu):
        r = requests.post(f"{API}/public/orders", json={
            "cafe_id": owner_with_menu["user"]["cafe_id"], "table_id": "nope",
            "items": [{"product_id": owner_with_menu["prod"]["id"], "qty": 1}],
        })
        assert r.status_code == 404

    def test_public_order_empty_items_400(self, owner_with_menu):
        r = requests.post(f"{API}/public/orders", json={
            "cafe_id": owner_with_menu["user"]["cafe_id"],
            "table_id": owner_with_menu["table"]["id"],
            "items": [],
        })
        assert r.status_code == 400

    def test_public_order_drops_invalid_products(self, owner_with_menu):
        # Mix valid + invalid: invalid should be dropped, valid saved
        cid = owner_with_menu["user"]["cafe_id"]
        # create a fresh table so table lookup succeeds
        tbl = requests.post(f"{API}/tables", headers=_h(owner_with_menu["token"]),
                            json={"number": 43, "capacity": 2}).json()
        pid = owner_with_menu["prod"]["id"]
        r = requests.post(f"{API}/public/orders", json={
            "cafe_id": cid, "table_id": tbl["id"],
            "items": [{"product_id": pid, "qty": 1},
                      {"product_id": "bogus-nope", "qty": 5}],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        order = db.orders.find_one({"cafe_id": cid, "order_no": d["order_no"]})
        assert len(order["items"]) == 1
        assert order["items"][0]["product_id"] == pid

    def test_public_order_all_invalid_products_400(self, owner_with_menu):
        tbl = requests.post(f"{API}/tables", headers=_h(owner_with_menu["token"]),
                            json={"number": 44, "capacity": 2}).json()
        r = requests.post(f"{API}/public/orders", json={
            "cafe_id": owner_with_menu["user"]["cafe_id"], "table_id": tbl["id"],
            "items": [{"product_id": "bogus1", "qty": 1}, {"product_id": "bogus2", "qty": 2}],
        })
        assert r.status_code == 400


# ------- Split Payments -------
class TestSplitPayments:
    def test_create_order_with_split(self, owner_with_menu):
        pid = owner_with_menu["prod"]["id"]
        tbl = requests.post(f"{API}/tables", headers=_h(owner_with_menu["token"]),
                            json={"number": 50, "capacity": 2}).json()
        body = {
            "items": [{"product_id": pid, "name": "TEST_QRProd", "price": 200.0, "qty": 1}],
            "order_type": "dine_in", "table_id": tbl["id"],
            "discount": 0, "tax_rate": 5.0,
            "payment_method": "split",
            "payment_splits": [{"method": "cash", "amount": 100},
                               {"method": "upi", "amount": 110}],
        }
        r = requests.post(f"{API}/orders", headers=_h(owner_with_menu["token"]), json=body)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["payment_method"] == "split"
        assert o["payment_status"] == "paid"
        assert o["payment_splits"] and len(o["payment_splits"]) == 2
        assert o["payment_splits"][0]["method"] == "cash"
        assert o["payment_splits"][0]["amount"] == 100
        # Retrieve via GET and verify persistence
        r2 = requests.get(f"{API}/orders/{o['id']}", headers=_h(owner_with_menu["token"]))
        assert r2.status_code == 200
        g = r2.json()
        assert g["payment_splits"] and len(g["payment_splits"]) == 2
        assert g["payment_method"] == "split"
        assert g["payment_status"] == "paid"

    def test_regular_order_without_splits_still_works(self, owner_with_menu):
        pid = owner_with_menu["prod"]["id"]
        body = {
            "items": [{"product_id": pid, "name": "TEST_QRProd", "price": 200.0, "qty": 1}],
            "order_type": "takeaway", "tax_rate": 5.0, "payment_method": "cash"
        }
        r = requests.post(f"{API}/orders", headers=_h(owner_with_menu["token"]), json=body)
        assert r.status_code == 200
        o = r.json()
        assert o["payment_method"] == "cash"
        assert o["payment_status"] == "paid"
        assert o.get("payment_splits") is None
