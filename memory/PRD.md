# NexoraOS — Café Operations SaaS · PRD

**Tagline:** Café Operations, Simplified. **Powered by PEAN.**

## Personas
- **Super Admin** — seeded (contact@officialdukaan.in). `/nexoraosadmin` full visibility + CSV export.
- **Owner** — full café access, staff, subscription, multi-café on Pro.
- **Manager / Cashier / Kitchen Staff** — RBAC-scoped access.
- **Guest (QR)** — scans table QR, orders → straight to KDS.

## Implemented

### Iter 1 (2026-02) — 28/28 tests pass
- FastAPI monolith, JWT auth, per-café tenant isolation, RBAC.
- OTP signup/reset via Emergent Resend.
- 12 pages (Dashboard/POS/Tables/Orders/Kitchen/Menu/Inventory/Customers/Staff/Reports/Subscription/Settings).
- Razorpay LIVE checkout for Café Plan.
- Warm café aesthetic (Outfit + Plus Jakarta Sans + JetBrains Mono).

### Iter 2 — 23/23 tests pass
- Google Sign-In (Client ID `682420913410-…`) with auto-café provisioning.
- Table QR Ordering — printable QR → mobile `/order` page → server-priced orders → KDS.
- Split payments in POS with server-side sum-equals-total validation.
- Super-admin console at `/nexoraosadmin` (dark theme).

### Iter 3 — 18/18 tests pass
- **Live Kitchen Sync via WebSocket** `/api/ws/kds?token=…`. KDS shows LIVE badge, auto-reconnects with 3s backoff, pings every 25s. Broadcasts on cashier order create/update AND public QR order. Tenant-isolated per café.
- **Multi-Café Pro Plan** — new tiers ₹299/mo & ₹2,499/yr granting up to 3 cafés. Sidebar café-switcher dropdown for owners; "Upgrade to Pro" upsell when a non-Pro owner tries to add a second café. `/cafes/mine`, `/cafes` (POST), `/cafes/switch` endpoints with new JWT on switch.
- **Invoice CSV Export** — Admin → Invoices → Export CSV. Streams `nexoraos-invoices-YYYYMMDD.csv` with Invoice ID / Date / Café / Café ID / Plan / Amount / Payment ID / Subscription ID.

### Iter 4 — Responsive mobile & tablet UX
- **Mobile layout (<1024px)**: sticky top bar with hamburger + café name, drawer-based sidebar, 4-tab bottom nav (Home/POS/Orders/KDS), safer 44px tap targets.
- **Mobile POS**: floating pill cart button (qty · total) → full-height bottom-sheet cart drawer with all POS controls; horizontally scrollable categories; 2-col product grid.
- **Tablet KDS**: 2×2 responsive KDS board (mobile stacks; tablet 2-col; desktop 4-col).
- **Responsive tables**: all admin/data tables wrapped in `overflow-x-auto` with min-width so they scroll horizontally on small screens instead of squashing.
- **Dashboard/Reports KPI grid**: 2-col on mobile, adaptive on desktop; header quick-actions become a 2-col grid on mobile.
- **Admin console** also gets hamburger drawer + top bar on small screens.
- **Modals** slide up from bottom on small screens (invoice, split payment, cart).

## Backlog / Next
- **P1 — Guest cart sessions** so QR guests review before placing.
- **P1 — Auto-Seed Demo Data** for empty cafés.
- **P2 — Cross-café analytics** for Pro owners (single dashboard aggregating all cafés).
- **P2 — CSV/PDF export** for reports (mirroring admin export).
- **P2 — Loyalty & customer segments.**
- **P3 — Multi-language receipts, i18n.**
- **P3 — ESC/POS kitchen printer integration.**
- **P3 — Server-price authenticated orders** (currently trusts client price for `/api/orders`; public flow already resolves from DB).

## Known Deviations (accepted for MVP)
- Stateless JWT (switch does not revoke prior tokens issued for other cafés).
- server.py is a 1107-line monolith — split when it grows further.
- WS token expiry not re-checked mid-session.
- OTP is logged in backend log for dev; strip in prod.
- CORS `allow_origins=*` — tighten in prod.
- N+1 queries in `/admin/cafes` and `/admin/invoices/export`; fine at current scale.
