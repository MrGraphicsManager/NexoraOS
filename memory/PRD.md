# NexoraOS — Café Operations SaaS · PRD

**Tagline:** Café Operations, Simplified. **Powered by PEAN.**

## Personas
- **Super Admin** — single seeded account (contact@officialdukaan.in). Views every café, subscription and invoice at `/nexoraosadmin`.
- **Owner** — full café access, staff mgmt, subscription, settings.
- **Manager** — POS, orders, tables, menu, inventory, customers, reports, staff (view).
- **Cashier** — POS, orders, tables, customers.
- **Kitchen Staff** — Kitchen, orders.
- **Guest (QR)** — scans table QR, browses menu, places order → straight to KDS.

## Implemented (2026-02)

### Iteration 1
- FastAPI monolith with JWT auth, per-café tenant isolation, RBAC.
- OTP-based email signup / password reset (Emergent Resend).
- 12 protected pages: Dashboard, POS, Tables, Orders, Kitchen, Menu, Inventory, Customers, Staff, Reports, Subscription, Settings.
- Razorpay LIVE checkout for ₹149/mo & ₹1,199/yr with signature verification.
- Warm café aesthetic (Outfit + Plus Jakarta Sans + JetBrains Mono).
- **28/28 backend tests pass.**

### Iteration 2
- **Google Sign-In** on `/login` and `/signup` (client ID `682420913410-…`). New users get auto-provisioned café + 14-day trial.
- **Table QR Ordering**: every table on `/tables` has a QR button that shows a printable QR pointing at `/order?c=…&t=…`. Guests scan → mobile-friendly menu → place order (server resolves prices from DB, never client). Order lands in KDS with source=qr, table becomes occupied.
- **Split Payments**: POS "Split Payment" modal lets cashiers split total across cash / UPI / card. Backend validates amount enum and sum-equals-total.
- **Super-admin panel** at `/nexoraosadmin` (dark theme). Login → Overview KPIs (cafés, users, paid subs, trials, revenue, invoices, orders) + full café list + per-café detail (users, subscriptions, invoices) + platform-wide invoice log.
- **23/23 new backend tests pass** (admin RBAC, Google 401 on invalid token, public menu/orders, split payments).

## Backlog / Next
- **P1 — Live Kitchen Sync** via WebSocket (KDS instant updates).
- **P1 — Guest cart sessions** so QR guests can add-then-review before placing.
- **P2 — Multi-café for Pro plan** (schema already scoped by cafe_id).
- **P2 — Real-time table availability** on public QR menu.
- **P2 — CSV/PDF export** for reports & invoices.
- **P2 — Loyalty & customer segments.**
- **P3 — Multi-language receipts + i18n.**
- **P3 — Kitchen printer (ESC/POS) integration.**

## Known Deviations (accepted)
- Stateless JWT (no server-side session/blacklist on logout).
- OTP printed in backend log for dev; strip before prod.
- CORS `allow_origins=*` — tighten in prod.
- Server.py is a 946-line monolith — split into routers when it grows further.
- No pagination on list endpoints (fine for MVP scale).
- Authenticated /api/orders still trusts client-supplied item price (public /api/public/orders resolves from DB). Consider server-side resolution for authenticated flow too.
