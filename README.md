# TradeSync

> Internal operations portal for a **wholesale / distribution company** — CRM, inventory and sales challans with strict transactional stock logic.

A full-stack ERP/CRM platform for wholesale and distribution businesses, featuring customer CRM, inventory management, stock movements, sales challans, JWT authentication, and role-based access control.

---

## Table of Contents

1. [Features](#features)
2. [Critical Business Logic](#critical-business-logic)
3. [Tech Stack](#tech-stack)
4. [Repository Structure](#repository-structure)
5. [Database Schema](#database-schema)
6. [Quick Start (run locally)](#quick-start-run-locally)
7. [Detailed Local Setup](#detailed-local-setup)
8. [Environment Variables](#environment-variables)
9. [Test Credentials](#test-login-credentials)
10. [Role & Permission Matrix](#role--permission-matrix)
11. [API Reference](#api-reference)
12. [Frontend Pages](#frontend-pages)
13. [Seed Data](#seed-data)
14. [Postman Collection Guide](#postman-collection-guide)
15. [Deployment](#deployment)
16. [Docker](#docker)
17. [Architecture & Design Decisions](#architecture--key-design-decisions)
18. [Data Flow](#data-flow)
19. [Assumptions](#assumptions-read-carefully)
20. [Known Limitations](#known-limitations)
21. [Troubleshooting](#troubleshooting)
22. [Quick API Demo (curl)](#quick-api-demo-curl)
23. [Commit History](#commit-history)

---

## Features

### Authentication & Roles
- JWT-based login (`POST /api/auth/login`) returning a token plus the user profile.
- Four roles: **Admin, Sales, Warehouse, Accounts** — enforced server-side on every route via `requireAuth` + `requireRoles(...)` middleware. Role checks are also mirrored in the UI (buttons/pages hidden or disabled).
- Admin-only user management (`GET/POST /api/auth`).
- Deactivated users (`active = false`) cannot log in or use existing tokens.

### Customer CRM Module
- Fields: name, mobile, email, business name, GST number (optional), type (`RETAIL | WHOLESALE | DISTRIBUTOR`), address, status (`LEAD | ACTIVE | INACTIVE`), follow-up date, notes, created-by, timestamps.
- Add / edit / search (name, mobile, email, business name — case-insensitive substring) with **pagination** and type/status filters.
- Customer detail page with a **follow-up note timeline**: each note stores the text, the author, and a timestamp.

### Product & Inventory Module
- Fields: name, SKU (unique), category, unit price, current stock, min stock alert, location/warehouse.
- Add / edit / search (name, SKU), category filter, `lowStock=true` filter (returns products where `currentStock <= minStockAlert`).
- **Stock movement audit log**: every change records product, signed quantity change, movement type (`IN`/`OUT`), reason, created-by, timestamp, and — for challan-driven movements — the linked challan.
- Manual stock adjustments (IN always allowed; OUT guarded so stock can never go negative).

### Sales Challan Module
- Sales user picks a customer, builds multiple line items, and saves as **Draft** or proceeds to **Confirm**.
- Auto-incrementing challan number formatted `CHL-0001`, `CHL-0002`, … (DB sequence, race-safe).
- Statuses: `DRAFT → CONFIRMED → CANCELLED` (drafts are editable; confirmed/cancelled are not).
- **Line-item snapshots** of name, SKU and unit price at the time of creation.
- Confirmed challans can be cancelled, which **restocks** the deducted quantities (assumption, see §19).

### Dashboard
- KPI cards: total customers, active customers, products, low-stock count, draft challans, confirmed challans.
- Low-stock alert list and the 6 most recent challans, each linking to its detail page.

---

## Critical Business Logic

These are the parts the whole project is built around — implement carefully:

### Confirming a challan (deducts stock — transactional, atomic, never negative)

`POST /api/challans/:id/confirm` runs **one interactive Prisma transaction**:

1. Load the challan with its line items. Missing → `404`.
2. If already `CONFIRMED` or `CANCELLED` → `409` (cancelled challans can never be confirmed).
3. For **every** line item, run an **atomic guarded decrement**:
   ```sql
   UPDATE products
   SET currentStock = currentStock - <qty>
   WHERE id = <id> AND currentStock >= <qty>
   ```
   If the affected row count is `0`, the product does not have enough stock. The transaction is **aborted entirely** — the challan stays `DRAFT`, no rows are changed, no movements are written, and the caller receives:
   ```json
   { "success": false, "message": "Insufficient stock for \"Refined Sugar 1kg\" (SKU SUG-REF-1): current stock is 450, needed 1000" }
   ```
   with HTTP `409`.
4. Only after all lines pass: write one `StockMovement` row per line (`OUT`, reason `Challan confirm (CHL-XXXX)`, `challanId` linked), then set `status = CONFIRMED`, `confirmedAt = now()`.

Why this is safe: the `WHERE currentStock >= qty` guard makes the check-and-decrement a single atomic statement, so two concurrent confirms **cannot over-sell** the same stock. Because everything lives in one transaction, a failure on line 3 rolls back lines 1–2 (no partial commit).

### Cancelling a challan (restocks if confirmed)

`POST /api/challans/:id/cancel` also runs a transaction:

- **Draft** → simply set `CANCELLED` + `cancelledAt`. No stock was ever reserved, so nothing is restored.
- **Confirmed** → increment each line's product stock, write `IN` movements (`reason: Challan cancelled (CHL-XXXX)`), then set `CANCELLED`.
- Already cancelled → `409`.

The response message tells the caller which case happened: `"Challan cancelled and stock restored"` vs `"Challan cancelled"`.

### Product snapshot on line items (the design requirement)

`challan_items` stores `productName`, `productSku`, `unitPrice` and `lineTotal` **copied at creation time**. `productId` is an **optional** FK (`onDelete: SetNull`) used only for navigation in the UI — display never joins to the live product row. Consequences:

- Later price changes or renames do not rewrite history.
- Even if a product row is deleted from the database, the challan renders correctly with a `deleted` badge.

### Manual stock adjustment (never negative)

`POST /api/products/:id/stock-movements` (Warehouse/Admin):
- `IN` → `UPDATE ... currentStock = currentStock + qty`.
- `OUT` → same atomic guard as confirmation (`WHERE currentStock >= qty`), failing with `409` + the product name and current vs requested quantities if short.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | End-to-end type safety, `strict: true` on both apps |
| Backend framework | **Express 4** | For this scope NestJS adds DI/guard ceremony without proportional benefit; a thin routes→controllers→Prisma layering keeps everything transparent |
| ORM | **Prisma 6** | Type-safe client, readable schema DSL, migration workflow, interactive transactions |
| Database | **PostgreSQL 16** | `DECIMAL` for money, sequences for challan numbering, atomic `UPDATE ... WHERE` guards, free tiers (Neon/Supabase/Render) |
| Validation | **Zod** | Request-shape schemas compiled to types; readable per-field error messages |
| Auth | jsonwebtoken + bcryptjs | Industry-standard JWT + salted hashes |
| Frontend | **React 18 + Vite 6 + React Router 6 + Axios + Tailwind CSS 4** | Fast DX, small dependency surface, clean admin UI without a heavy component library |
| Infra | Docker Compose (Postgres), dotenv, git incremental history | Reproducible local dev; secrets never committed |

---

## Repository Structure

```
Mini-ERP-CRM-Operations-Portal/
├── docker-compose.yml              # PostgreSQL 16 + healthcheck + named volume
├── README.md                       # you are here
├── backend/
│   ├── package.json                # scripts: dev, build, start, migrate, seed
│   ├── tsconfig.json               # NodeNext, strict
│   ├── .env.example                # copy to .env
│   ├── prisma/
│   │   ├── schema.prisma           # full schema: enums, models, indexes, relations
│   │   ├── migrations/             # versioned SQL migrations (vcs-tracked)
│   │   └── seed.ts                 # idempotent demo-data seeder
│   └── src/
│       ├── index.ts                # bootstrap: connect DB, listen
│       ├── app.ts                  # express app: cors, json, routes, error handler
│       ├── config/env.ts           # zod-validated environment (fails fast)
│       ├── lib/prisma.ts           # PrismaClient singleton
│       ├── middleware/
│       │   ├── auth.ts             # requireAuth (JWT verify + DB check) & requireRoles(...)
│       │   ├── validate.ts         # zod body validator
│       │   └── errorHandler.ts     # notFound + centralized error -> JSON
│       ├── routes/                 # auth, customer, product, challan, dashboard routers
│       ├── controllers/            # request handlers (no business rules leak into routes)
│       ├── schemas/                # zod schemas per module
│       └── utils/
│           ├── errors.ts           # ApiError hierarchy (400/401/403/404/409)
│           ├── jwt.ts              # sign/verify JWT
│           └── pagination.ts       # page/pageSize parsing + CHL formatting
├── frontend/
│   ├── package.json                # scripts: dev, build (tsc + vite), preview
│   ├── vite.config.ts              # react + tailwind plugins, port 5173
│   ├── tsconfig.json
│   ├── .env.example                # copy to .env
│   └── src/
│       ├── main.tsx                # React root + BrowserRouter
│       ├── App.tsx                 # route table
│       ├── index.css               # tailwind import
│       ├── types.ts                # all API DTO types (mirror of backend)
│       ├── vite-env.d.ts
│       ├── api/
│       │   ├── client.ts           # axios instance: auth header, 401 auto-logout, error helper
│       │   └── endpoints.ts        # typed API functions per module
│       ├── context/AuthContext.tsx # user state + login/logout, persisted in localStorage
│       ├── router/guards.tsx       # RequireAuth + RequireRoles
│       ├── components/
│       │   ├── Layout.tsx          # sidebar shell + role badge + sign-out
│       │   └── ui.tsx              # Badge, Card, Button, Input, Select, Alert, Spinner, Pagination, formatters
│       └── pages/
│           ├── Login.tsx           # demo-account quick fill
│           ├── Dashboard.tsx       # KPIs, low stock, recent challans
│           ├── Customers.tsx       # list + search/filter + add/edit modal
│           ├── CustomerDetail.tsx  # contact info + follow-up timeline
│           ├── Products.tsx        # list + low-stock toggle + add/edit modal
│           ├── ProductDetail.tsx   # stock + movement history + adjust form (Warehouse/Admin)
│           ├── Challans.tsx        # list + search + status filter
│           ├── ChallanCreate.tsx   # customer picker + multi-line item builder
│           ├── ChallanDetail.tsx   # snapshot items + confirm/cancel (Sales/Admin)
│           └── NotFound.tsx
└── docs/postman/
    └── Mini-ERP-CRM.postman_collection.json   # every endpoint, token auto-captured
```

---

## Database Schema

### Entity–relationship overview

```
users 1───* customers            (customers.createdById)
users 1───* follow_ups           (follow_ups.createdById)
users 1───* stock_movements      (stock_movements.createdById)
users 1───* challans             (challans.createdById)

customers 1───* follow_ups       (CASCADE delete)
customers 1───* challans

products 1───* stock_movements   (CASCADE delete)
products 1───* challan_items     (optional FK, SET NULL on delete)
challans 1───* challan_items     (CASCADE delete)
challans 1───* stock_movements   (SET NULL on delete)
```

### Tables

**users**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| email | text UNIQUE | lowercased on create |
| passwordHash | text | bcrypt(10) |
| role | enum `ADMIN/SALES/WAREHOUSE/ACCOUNTS` | |
| active | bool | false blocks login + JWT use |
| createdAt / updatedAt | timestamptz | auto |

**customers**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| mobile | text | |
| email | text? | |
| businessName | text? | |
| gstNumber | text? | |
| type | enum `RETAIL/WHOLESALE/DISTRIBUTOR` | default WHOLESALE |
| address | text? | |
| status | enum `LEAD/ACTIVE/INACTIVE` | default LEAD |
| followUpDate | timestamptz? | |
| notes | text? | |
| createdById | FK → users | author, no delete |
| createdAt / updatedAt | timestamptz | |
| indexes | status, type, name | filter performance |

**follow_ups**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| customerId | FK → customers | ON DELETE CASCADE |
| note | text | |
| createdById | FK → users | |
| createdAt | timestamptz | the timeline timestamp |
| index | (customerId, createdAt) | |

**products**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| sku | text UNIQUE | |
| category | text | |
| unitPrice | decimal(12,2) | money stored as Decimal |
| currentStock | int | guarded against negative |
| minStockAlert | int | low-stock threshold (`currentStock <= minStockAlert`) |
| location | text? | aisle/warehouse |
| createdAt / updatedAt | timestamptz | |
| indexes | name, category | |

**stock_movements** (audit log — never deleted)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| productId | FK → products | ON DELETE CASCADE |
| quantityChange | int | signed: IN positive, OUT negative |
| movementType | enum `IN/OUT` | |
| reason | text | e.g. `Challan confirm (CHL-0001)`, `new batch received` |
| createdById | FK → users | |
| challanId | FK → challans? | SET NULL on challan delete; links sale movements |
| createdAt | timestamptz | |
| index | (productId, createdAt) | |

**challans**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| challanNumber | int UNIQUE AUTOINCREMENT | formatted `CHL-%04d` on read; DB-generated → collision-free |
| customerId | FK → customers | |
| status | enum `DRAFT/CONFIRMED/CANCELLED` | |
| totalQuantity | int | sum of line quantities |
| totalAmount | decimal(12,2) | sum of line totals, Decimal math |
| createdById | FK → users | |
| confirmedAt / cancelledAt | timestamptz? | audit |
| createdAt / updatedAt | timestamptz | |
| indexes | status, customerId, createdAt | |

**challan_items** (snapshot storage)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| challanId | FK → challans | ON DELETE CASCADE |
| productId | FK → products **nullable** | `SetNull` on delete; navigation only |
| productName | text | **snapshot** at time of sale |
| productSku | text | **snapshot** |
| unitPrice | decimal(12,2) | **snapshot** |
| quantity | int | |
| lineTotal | decimal(12,2) | unitPrice × quantity, Decimal math |
| index | challanId | |

---

## Quick Start (run locally)

Prerequisites: **Node 18+**, **Docker Desktop** (or any Postgres 16 instance), npm.

```bash
# 1. database
docker compose up -d db

# 2. backend (http://localhost:5000)
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev

# 3. frontend (http://localhost:5173) — new terminal
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173** and sign in — the login screen has one-click demo-account fill buttons.

---

## Detailed Local Setup

### Step 0 — Prerequisites
```bash
node --version   # >= 18
docker --version # for the database container
```
If you don't want Docker, point `DATABASE_URL` at any Postgres 16 (e.g. a local install or a Neon free-tier project) — nothing else changes.

### Step 1 — Database
```bash
docker compose up -d db
docker compose ps          # expect STATUS: healthy
```
The container exposes `5432` with user `minierp` / password `minierp_dev_password` / database `minierp` (all overridable in `docker-compose.yml`). Data persists in the named volume `minierp_pgdata`.

To start from a clean slate at any time:
```bash
cd backend && npx prisma migrate reset --force   # drops, re-migrates, re-seeds
```

### Step 2 — Backend
```bash
cd backend
cp .env.example .env        # then edit JWT_SECRET (>=16 chars) if you like
npm install
npx prisma migrate deploy    # apply ./prisma/migrations to the database
npx prisma db seed           # 4 users + demo customers/products/challans
npm run dev                  # tsx watch, http://localhost:5000
```

Verify:
```bash
curl http://localhost:5000/health
# {"success":true,"message":"Mini ERP + CRM API is running",...}
```

Other useful scripts:
```bash
npm run build          # tsc -> dist/
npm start              # run compiled dist (for deployment)
npx prisma migrate dev # create a new migration after schema changes
npx prisma db seed     # idempotent — safe to re-run
```

### Step 3 — Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

- `VITE_API_URL` defaults to `http://localhost:5000` (the value in `.env.example`), so no Vite proxy config is needed.
- CORS: the backend's `CORS_ORIGIN` default `http://localhost:5173` already matches.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Description | Default |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string | `postgresql://minierp:minierp_dev_password@localhost:5432/minierp?schema=public` |
| `JWT_SECRET` | ✅ | JWT signing secret — **minimum 16 chars** | `change-me-to-a-long-random-string` |
| `JWT_EXPIRES_IN` | — | token lifetime (jsonwebtoken format) | `1d` |
| `PORT` | — | API port | `5000` |
| `NODE_ENV` | — | `development \| test \| production` | `development` |
| `CORS_ORIGIN` | — | comma-separated list of allowed origins, `*` for all | `http://localhost:5173` |

`src/config/env.ts` validates these at boot with Zod — the server **refuses to start** with a helpful message if `DATABASE_URL` or a short `JWT_SECRET` is missing.

### Frontend (`frontend/.env`)
| Variable | Required | Description | Default |
|---|---|---|---|
| `VITE_API_URL` | — | Backend base URL the browser calls | `http://localhost:5000` |

**Never commit real `.env` files.** Only `.env.example` templates are tracked (see `.gitignore`).

---

## Test Login Credentials

Created by `npx prisma db seed`:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@minierp.com` | `Admin@123` |
| **Sales** | `sales@minierp.com` | `Sales@123` |
| **Warehouse** | `warehouse@minierp.com` | `Warehouse@123` |
| **Accounts** | `accounts@minierp.com` | `Accounts@123` |

---

## Role & Permission Matrix

| Capability | Admin | Sales | Warehouse | Accounts |
|---|---|---|---|---|
| Login & view dashboard | ✅ | ✅ | ✅ | ✅ |
| View customers, products, challans, movements | ✅ | ✅ | ✅ | ✅ |
| Add / edit customers, add follow-ups | ✅ | ✅ | ✅ | ✅ |
| Create / edit drafts | ✅ | ✅ | ❌ | ❌ |
| **Confirm / cancel challans** | ✅ | ✅ | ❌ | ❌ |
| Add / edit products | ✅ | ❌ | ✅ | ❌ |
| Manual stock adjustments (IN/OUT) | ✅ | ❌ | ✅ | ❌ |
| Create users | ✅ | ❌ | ❌ | ❌ |

Enforcement: server middleware (`requireRoles`) is the source of truth; the UI additionally hides buttons it cannot use (e.g. "New challan" only for Sales/Admin, "Adjust stock" only for Warehouse/Admin).

---

## API Reference

**Conventions**
- Base URL: `http://localhost:5000` (dev).
- All routes except `/health` and `/auth/login` require `Authorization: Bearer <token>`.
- Success shape: `{ "success": true, "data": ... }` (list endpoints also include `pagination`).
- Error shape: `{ "success": false, "message": "...", "details?": [...] }`.
- Status codes used: `200` OK · `201` Created · `400` validation/bad input · `401` unauthenticated · `403` wrong role · `404` not found · `409` state conflict (duplicate, insufficient stock, wrong status) · `500` server/db error.
- Validation errors include a `details` array: `[{ "path": "mobile", "message": "Enter a valid mobile number (7-15 digits)" }, ...]`.
- Pagination: `?page=1&pageSize=20` (pageSize 1–100). Response:
  ```json
  "pagination": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 }
  ```

### Auth
| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public | returns `{ token, user }` |
| GET | `/api/auth/me` | all | current user from token |
| GET | `/api/auth` | admin | list users |
| POST | `/api/auth` | admin | create user `{ name, email, password, role }` |

```bash
curl -X POST localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sales@minierp.com","password":"Sales@123"}'
```
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 2, "name": "Sales User", "email": "sales@minierp.com", "role": "SALES" }
}
```

### Customers
| Method | Route | Description |
|---|---|---|
| GET | `/api/customers` | list — `search`, `type`, `status`, `page`, `pageSize` |
| POST | `/api/customers` | create (validation: name ≥2 chars, mobile pattern, email format, enums) |
| GET | `/api/customers/:id` | detail incl. `createdBy`, follow-up count, challan count |
| PATCH | `/api/customers/:id` | partial update |
| GET | `/api/customers/:id/follow-ups` | timeline, newest first, with author |
| POST | `/api/customers/:id/follow-ups` | add note `{ "note": "..." }` |

```bash
curl "localhost:5000/api/customers?search=traders&type=WHOLESALE&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```
Create body example:
```json
{
  "name": "Amit Traders", "mobile": "9810012345",
  "email": "amit@traders.in", "businessName": "Amit Traders",
  "gstNumber": "27ABCDE1234F1Z5", "type": "WHOLESALE",
  "address": "Shop 5, Main Bazaar, Delhi", "status": "LEAD",
  "followUpDate": "2026-09-01T00:00:00.000Z", "notes": "Introductory meeting booked."
}
```
Notes: `followUpDate` accepts ISO-8601; empty strings are normalized to `null`.

### Products & Inventory
| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/products` | all | list — `search` (name/SKU), `category`, `lowStock=true`, `page`, `pageSize` |
| POST | `/api/products` | W/A | create |
| GET | `/api/products/:id` | all | detail |
| PATCH | `/api/products/:id` | W/A | partial update (any editable field) |
| GET | `/api/products/:id/stock-movements` | all | audit log, paginated, includes author + linked challan |
| POST | `/api/products/:id/stock-movements` | W/A | manual adjustment `{ movementType, quantity, reason }` |

```bash
# manual IN
curl -X POST localhost:5000/api/products/5/stock-movements \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"movementType":"IN","quantity":50,"reason":"new batch received"}'

# manual OUT when stock is short -> 409, nothing changes
curl -X POST localhost:5000/api/products/5/stock-movements \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"movementType":"OUT","quantity":10000,"reason":"oops"}'
# {"success":false,"message":"Insufficient stock for \"Tea Powder 250g\": current stock is 8, requested 10000"}
```

### Challans
| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/challans` | all | list — `search` (number `CHL-0001` or `0001` or customer name), `status`, `page`, `pageSize` |
| POST | `/api/challans` | S/A | create draft `{ customerId, items: [{ productId, quantity }] }` |
| GET | `/api/challans/:id` | all | detail incl. snapshot `items`, customer, createdBy |
| PATCH | `/api/challans/:id` | S/A | edit **draft only** (customer and/or items; snapshots rebuilt) |
| POST | `/api/challans/:id/confirm` | S/A | **transactional stock deduct** (see §2) |
| POST | `/api/challans/:id/cancel` | S/A | cancel; restocks if it was confirmed |

```bash
# create draft
curl -X POST localhost:5000/api/challans \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"customerId":1,"items":[{"productId":1,"quantity":10},{"productId":4,"quantity":50}]}'
```
```json
{
  "success": true,
  "data": {
    "id": 3, "challanNumber": "CHL-0003", "customerId": 1,
    "status": "DRAFT", "totalQuantity": 60, "totalAmount": 6900,
    "createdById": 2, "confirmedAt": null, "cancelledAt": null
  }
}
```
Detail (shows the snapshot columns on `items`):
```json
{
  "success": true,
  "data": {
    "challanNumber": "CHL-0003", "status": "DRAFT",
    "items": [
      { "id": 5, "productId": 1, "productName": "Basmati Rice 5kg", "productSku": "RICE-BAS-5", "unitPrice": 480, "quantity": 10, "lineTotal": 4800 }
    ]
  }
}
```
Confirm → `200` with `"Challan confirmed and stock deducted"`; insufficient stock → `409` with the failing product, challan untouched. Cancel → `"Challan cancelled and stock restored"` (confirmed) or `"Challan cancelled"` (draft).

### Dashboard
| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | `metrics` (customers, activeCustomers, products, lowStockCount, draftChallans, confirmedChallans), `lowStockProducts` (top 10), `recentChallans` (last 6) |

---

## Frontend Pages

| Page | Route | What it does |
|---|---|---|
| Login | `/login` | demo-account quick-fill buttons; redirects to intended page |
| Dashboard | `/` | 6 KPI cards (link into filtered lists), red low-stock cards, recent challans |
| Customers | `/customers` | debounced search, type/status filter dropdowns, add/edit modal, paginated table |
| Customer detail | `/customers/:id` | full contact info, status/type badges, follow-up timeline with add-note form |
| Products | `/products` | search, category filter, **Low stock only** toggle (URL-synced `?lowStock=true`), add/edit modal |
| Product detail | `/products/:id` | stock & price card, movement history table (IN/OUT, reason, author, challan link), role-gated adjust-stock form |
| Challans | `/challans` | search by number/customer, status filter, paginated table |
| New challan | `/challans/new` | customer picker + product picker + line-item builder (qty editable, price snapshot shown, running totals) |
| Challan detail | `/challans/:id` | snapshot line-item table (deleted-product badge), status timeline, confirm/cancel actions with confirmation dialogs + restock warnings |

UX details: role-aware action buttons, `alert()`/inline alerts for API errors with backend messages, 401 anywhere → auto-logout to `/login`, empty/loading states everywhere.

---

## Seed Data

`npx prisma db seed` is **idempotent** (skips existing records by unique key):

- **4 users** — one per role (credentials in §9).
- **5 customers** — mix of retail/wholesale/distributor, active/lead/inactive; one lead carries 2 follow-up notes; one has a future follow-up date.
- **10 products** — grocery catalogue (~₹42–₹480); three are **below alert level** (`Tea Powder 250g` 8/25, `Detergent Powder 1kg` 12/30, `Toor Dal 1kg` 25/40) so the low-stock UI lights up immediately; each product gets an "Opening stock" IN movement.
- **2 challans** — one `CONFIRMED` (with matching stock decrements and OUT movements), one `DRAFT`, so list/detail/dashboard all have data.

---

## Postman Collection Guide

Import `docs/postman/Mini-ERP-CRM.postman_collection.json`:

1. **Import** → select the file.
2. **Collection variables** → edit `baseUrl` if your API is not on `localhost:5000` (also `customerId`, `productId`, `challanId` for convenience).
3. Run **Auth → Login**. A test script stores the returned `token` as a collection variable — every other request automatically sends `Authorization: Bearer {{token}}`.
4. To dry-run role permissions, change the Login body to a different seeded account (e.g. `accounts@...`) and re-run; the guarded routes will return `403`.
5. The **Create draft challan** request auto-saves the new challan's id into `challanId`, so you can immediately chain **Confirm** and **Cancel**.
6. Try the negative path: set a quantity larger than the product's stock and confirm — you should see the `409` insufficient-stock response, and the product's stock should be unchanged afterwards.

---

## Deployment

### ✅ Live on AWS (free tier)

The app is currently deployed on AWS (~$0/month while the free tier lasts):

- **Frontend:** S3 + CloudFront → https://d3eormzf4777t6.cloudfront.net
- **Backend:** Express API on EC2 (Docker), served through the same CloudFront domain (`/api/*`, `/health`)
- **Database:** PostgreSQL 16 in Docker on the same EC2 instance

Full step-by-step guide: **docs/AWS_DEPLOYMENT.md** (includes the exact redeploy, backup and
update commands). Production artifacts: `backend/Dockerfile` and `docker-compose.prod.yml`.

### Alternative free-tier hosts (Render / Vercel / Neon)

The app also runs fine on any free-tier host:

1. **Database — Neon / Supabase / Render Postgres (free):**
   - Create a project, copy the pooled/unpooled connection string.
   - `cd backend && cp .env.example .env`, set `DATABASE_URL`, then `npx prisma migrate deploy` (from your machine or a Render shell) and `npx prisma db seed`.

2. **Backend — Render free web service:**
   - Build command: `npm install && npx prisma migrate deploy && npm run build`
   - Start command: `npm start`
   - Environment: `DATABASE_URL`, `JWT_SECRET` (strong!), `JWT_EXPIRES_IN`, `NODE_ENV=production`, `CORS_ORIGIN=https://<your-frontend-domain>`.

3. **Frontend — Vercel / Netlify:**
   - Root directory: `frontend`
   - Build: `npm run build` (outputs `dist`)
   - Environment: `VITE_API_URL=https://<your-render-service>.onrender.com`

---

## Docker

`docker-compose.yml` runs only the database (the apps run via `npm run dev` for the smoothest local DX):

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: POSTGRES_USER/PASSWORD/DB = minierp / minierp_dev_password / minierp
    ports: 5432:5432
    volumes: minierp_pgdata        # named volume -> data survives restarts
    healthcheck: pg_isready       # `docker compose ps` shows healthy
```

Common commands:
```bash
docker compose up -d db           # start
docker compose down               # stop (data kept)
docker compose down -v            # stop AND delete data volume
```

---

## Architecture & Key Design Decisions

**Express over NestJS** — For this feature set, NestJS adds DI, guards and modules without proportional benefit. Express keeps the code flat and greppable. Layering is preserved with discipline: routes select middleware → controllers handle HTTP → Prisma owns all SQL → Zod owns all request shapes.

**Validation at the edge** — every mutating route runs a Zod schema through `validate()` middleware. Errors are normalized to `{ path, message }` arrays with useful text like *"Quantity must be a positive whole number"*, returning HTTP 400.

**One error pipeline** — `ApiError` subclasses (`BadRequest 400`, `Unauthorized 401`, `Forbidden 403`, `NotFound 404`, `Conflict 409`) thrown anywhere in the stack are rendered by a single `errorHandler`; Prisma known errors (`P2002` unique, `P2025` not-found) are mapped to 409/404. `express-async-errors` ensures rejected promises from async handlers never crash the process.

**Money is Decimal, not float** — `unitPrice`/`lineTotal`/`totalAmount` are `DECIMAL(12,2)` in Postgres and Prisma `Decimal` in TS, summed with `Decimal.add`/`mul`. Serialized back to JSON as plain numbers.

**Auto-increment challan numbers** — a DB-level auto-increment column, formatted `CHL-%04d` only at serialization time. No "generate then pray" logic, no lock contention; the number is final and unique even under concurrent creates. Search accepts `CHL-0003`, `0003` or a customer name.

**Atomic stock guards over read-then-write** — every decrement is a single `UPDATE ... WHERE currentStock >= qty`. Combined with the interactive transaction on confirm, this eliminates both partial commits and double-selling races without explicit row locks.

**Snapshots for sale history** — `challan_items` store name/SKU/unitPrice at creation (§2). The optional `productId` FK exists purely for deep links; `SetNull` keeps history intact if a product is ever removed.

**Frontend as a thin client** — all business rules live in the API. The UI renders server messages verbatim (`getErrorMessage`), so users see the real reason a confirmation failed. Role gating in the UI is a UX nicety; the API is the authority.

---

## Data Flow

```
React page                      express route                      PostgreSQL
─────────                       ────────────                       ──────────
ChallanDetail "Confirm"  ──►  POST /challans/:id/confirm
  (confirm() dialog)          │ requireAuth (JWT verify + DB hit)
                              │ requireRoles(SALES, ADMIN)  ── 403 if not
                              │ $transaction(async tx => {
                              │   read challan + items        ── SELECT
                              │   for each item:
                              │     guarded decrement         ── UPDATE ... WHERE stock >= qty
                              │       (0 rows → throw 409 → ROLLBACK)
                              │   write OUT movements         ── INSERT stock_movements × n
                              │   set CONFIRMED/confirmedAt   ── UPDATE challans
                              │ })  ── COMMIT atomically
                              │ 200 { message: "confirmed...", data }
  alert(success)  ◄──────────┘
```

Auth flow: `login` → JWT stored in localStorage → axios request interceptor injects `Authorization: Bearer …` → any 401 response clears the session and redirects to `/login`.

---

## Assumptions (read carefully)

1. **Cancelling a Confirmed challan restocks the quantities.** The business meaning of cancellation is "goods return to inventory". State the alternative policy in config if you disagree.
2. **Stock is only touched on confirmation.** Draft creation and editing reserve nothing. A confirmation that fails leaves the challan `DRAFT`, so it can be retried after restocking.
3. **Confirmed/Cancelled challans are immutable** except for status transitions (no item edits).
4. **Only Sales and Admin may create, edit, confirm and cancel challans** (per the original brief: "only Sales/Admin can confirm challans"). Warehouse and Accounts are read-only on challans.
5. **All authenticated users may add/edit customers and follow-ups**; no per-owner CRM visibility rules were requested.
6. **Product deletion is intentionally not exposed via API.** It would silently orphan history; snapshots and `SetNull` FKs already protect challans and movements. An admin could delete via SQL without corrupting history.
7. **Follow-up dates and timestamps are stored in UTC** (Postgres `timestamptz`); the UI renders in the browser's local timezone.
8. **Draft edits rebuild line items** (delete + recreate) rather than diffing — snapshot values are simply refreshed to current product values at edit time.

---

## Known Limitations

- ❌ **No password reset, email, or 2FA** — passwords change via DB only; token revocation means deleting the user or rotating `JWT_SECRET`.
- ❌ **No refresh-token rotation** — single JWT, `1d` lifetime, frontend auto-logout on 401.
- ❌ **No invoice/PDF export** (bonus scope, not implemented).
- ❌ **No product images / S3 uploads** (bonus scope, not implemented).
- ❌ **No CI/CD pipeline** (bonus scope, not implemented; Docker Compose provided).
- ❌ **No automated test suite** — verified end-to-end during development; seed + Postman collection serve as the manual regression harness.
- ⚠️ **Dropdown limits** — the challan builder loads up to 100 customers and 100 products (API caps `pageSize` at 100). Beyond that, search-based selection would be needed.
- ⚠️ **No product archive flag** — "discontinued" products must instead have stock set to 0.
- ⚠️ **Single sign-in session per browser** — the frontend keeps one token; logging in as another role wipes the previous token.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE :::5000` when starting backend | Another instance is running: `netstat -ano \| grep :5000`, `taskkill //F //PID <pid>`, retry |
| `Database error (P1001)` / connection refused | Postgres not started: `docker compose up -d db`, wait for `healthy` |
| `DATABASE_URL is required` / `JWT_SECRET must be at least 16 characters` | `backend/.env` missing/wrong — copy `.env.example`, edit, restart |
| Login returns 401 for seeded users | Seed not run or DB reset: `npx prisma db seed` |
| Frontend "Network Error" / CORS | `vite` on 5173, backend on 5000; check `VITE_API_URL` and backend `CORS_ORIGIN` |
| Confirmed challan shows wrong stock | Never happens via API (transactional), but check the `stock_movements` audit on the product page — every quantity change is traceable |
| `prisma migrate` says drift | You changed `schema.prisma` without a migration — run `npx prisma migrate dev` to diff, or `reset --force` to start over (dev only) |

---

## Quick API Demo (curl)

```bash
BASE=http://localhost:5000
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"sales@minierp.com","password":"Sales@123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# create a draft challan
curl -s -X POST $BASE/api/challans -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId":1,"items":[{"productId":1,"quantity":5}]}'

# confirm it (stock 100 -> 95 on Basmati Rice)
curl -s -X POST $BASE/api/challans/<id>/confirm -H "Authorization: Bearer $TOKEN"

# cancel it (stock back to 100) with restock message
curl -s -X POST $BASE/api/challans/<id>/cancel -H "Authorization: Bearer $TOKEN"
```

---

## Commit History

The repository intentionally follows **small, meaningful, module-by-module commits**:

```
d24e1ae docs: update AWS guide with real deployed domain, EC2 IP and CLI gotchas
943da3b chore(deploy): AWS production artifacts (Dockerfile, docker-compose.prod.yml, deployment guide)
236427a docs: expand README with full schema reference, API examples, data flow, troubleshooting and demo scripts
c8fefe2 docs: README + Postman collection for every endpoint
51b6270 feat(frontend): challan list, multi-line builder, confirm/cancel actions
62c501f fix(frontend): Alert component accepts className
403de25 feat(frontend): customers and products pages
496ba44 feat(frontend): app shell, auth context, API client, router, dashboard
dd59859 feat(backend): dashboard summary endpoint
405e832 fix(backend): cancel restock message + seeded demo challans
7d2bf0e feat(backend): challans — snapshots + transactional confirm/cancel
6cf1ad8 feat(backend): products & inventory + stock movement audit
1ae2faf feat(backend): customers CRM + follow-ups
0b0e7ca feat(backend): auth module + full Prisma schema + seed users
1285ac9 chore: monorepo scaffold (backend + frontend + docker-compose)
263214e Initial commit (repo bootstrap)
```
