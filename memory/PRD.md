# NexoraOS — Café Operations SaaS · PRD

**Tagline:** Café Operations, Simplified. **Powered by PEAN.**

## Problem Statement (verbatim summary)
Production-ready café SaaS with POS, tables, KDS, orders, menu, inventory, customers, staff (RBAC), reports, Razorpay subscription (₹149/mo, ₹1,199/yr), settings. Email + OTP auth. Multi-tenant, one café per owner (multiple for pro plan — future).

## Personas
- **Owner** — full access, staff mgmt, subscription, settings.
- **Manager** — POS, orders, tables, menu, inventory, customers, reports, staff (view).
- **Cashier** — POS, orders, tables, customers.
- **Kitchen Staff** — Kitchen, orders.

## Core Requirements (static)
1. Email/password + OTP verification signup (Emergent-managed Resend).
2. JWT auth (Bearer header) with per-café tenant isolation on every query.
3. All CRUD works: categories, products, tables, orders, customers, inventory, staff.
4. KDS with real-time status transitions (new → preparing → ready → completed).
5. Reports with charts (Recharts) for 1/7/30/90 day ranges.
6. Razorpay live checkout for monthly/yearly plans with signature verification.
7. Warm, minimal café aesthetic (Outfit + Plus Jakarta Sans + JetBrains Mono).

## Implemented (2026-02)
- Backend FastAPI monolith (`/app/backend/server.py`) — 22 endpoints across auth, cafe, categories, products, tables, orders, customers, inventory (+ stock txn), staff, dashboard, reports, subscription.
- OTP email via Emergent Resend proxy; JWT tokens with cafe_id + role claims.
- Frontend React SPA with 12 pages + Landing + Login/Signup/ForgotPassword.
- Warm café design system: coffee brown, terracotta, cream palette in `index.css`.
- Razorpay checkout integration on Subscription page with live keys.
- Backend testing: 28/28 pytest cases pass (tenant isolation, RBAC, CRUD, order flow).

## Backlog / Next
- **P1 — Real-time KDS via WebSocket** so kitchen updates instantly across devices.
- **P1 — Split-bill & partial payments** in POS.
- **P2 — Multi-café for Pro plan** (schema is already `cafe_id`-scoped; expose selector).
- **P2 — Auto low-stock reorder suggestions** using stock-txn history.
- **P2 — CSV/PDF export** for reports.
- **P2 — Loyalty points** & customer segments.
- **P3 — Table QR ordering** so guests self-order.
- **P3 — Kitchen printer integration** (ESC/POS).
- **P3 — Multi-language receipts.**

## Known Deviations (accepted)
- Stateless JWT (no server-side session/blacklist on logout).
- OTP logged in plaintext to backend log for dev; strip before prod.
- CORS `allow_origins=*` — tighten in prod.
- No pagination on list endpoints (fine for MVP scale).
