# VillageMan — Implementation Blueprint

> Residential Community Management System for housing estates / neighborhood associations.
> **Config:** Local-now / cloud-ready · 3–10 committee admins · QR/slip-based payments · Google Sheets as future shared backend.

---

## 1. Design Philosophy

The system is built **local-first** but **cloud-ready**. All data access flows through a single **Repository layer**, so the storage engine can be swapped without touching UI code:

- **Phase 1 (now):** `LocalRepo` → browser `localStorage`. Works offline, single committee device, full editing.
- **Phase 2 (later):** `GoogleSheetRepo` → reads a published Google Sheet via an **Apps Script web app** (Sheet stays private, script gates access, can write back later). Residents click a shared link → live, view-only dashboard, **no login, no import**.

Privacy on the shared view: **mask names** — community totals + each house sees its own detail; other houses shown as "House 12" without names.

```
        UI Modules (dashboard, finance, directory, vendors, emergency)
                              |
                   Repository Interface   <-- SWAP POINT
                    /                  \
        Phase 1: LocalRepo        Phase 2: GoogleSheetRepo
        (localStorage)            (Apps Script -> private Sheet)
```

---

## 2. Tech Stack

### Phase 1 — Local now
| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vanilla JS (ES modules) + HTML + CSS | Matches Cash Flow Planner conventions |
| Data | `localStorage` behind a Repository | Lean JSON rows; fine for a village's scale |
| Payments | PromptPay QR generated client-side (EMVCo string) | No gateway, no fees, offline |
| Receipts | Client-side printable receipt with running numbers | Auditable |
| Serving | Local web server (ES modules need http:// origin) | Same as Cash Flow Planner |

**No installs needed** beyond the local web server already used for the Cash Flow Planner. No database software, no Node, no build tools, no cloud account (Phase 1).

### Phase 2 — Shared, live (cloud-ready)
| Layer | Choice | Notes |
|---|---|---|
| Backend | Google Apps Script web app | Free, Google-hosted, Sheet stays private |
| Database | Google Sheet (one tab per entity) | Human-readable, backed up, no lock-in |
| Permissions | Google's native sharing + script-side masking | View-only for residents |
| Sharing | One published link | Click → live dashboard, no login/import |

---

## 3. Data Model (entities)

- **households** — house_no, owner_name, tenant_name, phone, email, status
- **fee_types** — name, default_amount, recurrence (monthly/yearly)
- **fee_charges** — household, fee_type, period (YYYY-MM), amount_due, due_date, status
- **payments** — fee_charge, paid_amount, paid_date, method (qr/slip/cash/transfer), slip_url, receipt_no (running: RC-2026-0001)
- **expenses** — category (utility/repair/cleaning/maintenance), description, amount, expense_date, vendor, receipt_url
- **vendors** — name, service_type, phone, email, notes, rating
- **emergency_contacts** — label, phone, category (police/fire/hospital/security), sort_order
- **users** — username, role (admin/treasurer/viewer) [Phase 2]

**Why charges are separate from payments:** a charge is what's owed; a payment is money received against it. This enables partial payments and accurate "who owes what for which month." A charge's status derives from SUM(payments) vs amount_due.

---

## 4. Module Structure (Phase 1 files)

```
VillageMan/
├── index.html            app shell + sidebar nav + styles
├── BLUEPRINT.md          this document
└── js/
    ├── repo.js           Repository interface + LocalRepo (SWAP POINT)
    ├── data.js           schema defaults, defaultData() -> empty arrays/zeros only
    ├── util.js           formatting (dd/mm/yyyy, THB), id/receipt generators
    ├── promptpay.js      EMVCo PromptPay QR string builder
    ├── ui-dashboard.js   KPIs, income vs expense chart, overdue table
    ├── ui-households.js  resident/household directory
    ├── ui-finance.js     charges, payments, receipts, expenses, reports
    ├── ui-vendors.js     vendor directory
    ├── ui-emergency.js   emergency contacts hub
    └── app.js            boot, routing, nav wiring
```

**Shareability rule (carried from Cash Flow Planner):** NEVER hardcode personal/sensitive data. `defaultData()` returns only zeros and empty arrays. All data comes from storage. The code is always shareable as-is.

---

## 5. UI / Dashboard Structure

Sidebar navigation:
- **Dashboard** — 4 KPI cards (Collected this month · Outstanding · Expenses this month · Balance), income-vs-expense chart, overdue households table
- **Finance** — Income (charges & payments + QR/receipt), Expenses, Reports (net income, balance)
- **Households** — directory + owe status
- **Vendors** — searchable by service type
- **Emergency** — quick-dial cards
- **Settings** — fee types, PromptPay ID, (Phase 2: users/roles, Sheet URL)

**Record Payment flow:** select household → show outstanding charges → Generate PromptPay QR (exact amount) → resident pays → committee marks paid / uploads slip → system assigns running receipt_no → printable receipt.

---

## 6. Phase 2 API (Apps Script endpoints)

The Apps Script web app exposes read (and later write) actions the `GoogleSheetRepo` calls:

```
GET  ?action=households            -> list (with owe balance, names masked per policy)
GET  ?action=charges&period=YYYY-MM
GET  ?action=payments
GET  ?action=expenses&from=&to=
GET  ?action=vendors
GET  ?action=emergency
GET  ?action=summary&period=       -> { income, expense, net, balance }
POST ?action=payment               -> (later) resident submits slip
```

Same method names exist on `LocalRepo` in Phase 1, so swapping is a drop-in.

---

## 7. Build Sequence

1. **Blueprint document** (this file) ✓
2. **App skeleton** — repo.js (Repository + LocalRepo), data.js, util.js, app shell + sidebar
3. **Households module**
4. **Finance module** (charges + payments + PromptPay QR + receipts + expenses + reports)
5. **Vendors + Emergency modules**
6. **JSON export/import** (backup + snapshot sharing)
7. **Phase 2** — GoogleSheetRepo + Apps Script + Sheet template (when ready)

---

*VillageMan project — implementation blueprint.*
