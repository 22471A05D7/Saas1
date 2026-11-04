<<<<<<< HEAD
# StockFlow

A multi-tenant SaaS inventory management system. Each organization is a fully
isolated tenant: it sees only its own products, stock levels, and statistics.

**Stack:** PostgreSQL · Prisma ORM · Node.js · Express · TypeScript · Next.js (App Router) · React · Tailwind CSS · JWT + bcrypt

---

## Contents

- [How to run](#how-to-run)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Environment variables](#environment-variables)
- [Tenant isolation](#how-tenant-isolation-is-enforced)
- [Stock concurrency](#how-concurrent-stock-updates-stay-correct)
- [Low-stock rules](#low-stock-rules)
- [Testing](#testing)
- [Limitations](#limitations)

---

## How to run

Short version, for a machine that already has Node.js 20+ and PostgreSQL
running. Full detail — including the test database and seed data — is in
[Quick start](#quick-start).

```bash
# 1. install (npm workspaces: one install covers both apps)
npm install

# 2. create the database
createdb stockflow

# 3. configure
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
#    then edit apps/api/.env: set DATABASE_URL and JWT_SECRET
#    generate a secret with:
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. create the tables and the Prisma Client
npm run db:setup

# 5. (optional) demo data for two tenants
npm run seed --workspace=apps/api

# 6. run both apps
npm run dev
```

Then open **http://localhost:3000** and sign up — you land on the dashboard.
The API serves on **http://localhost:4000**, but the browser never calls it
directly; the Next.js proxy forwards every request.

With seed data you can log in instead, as `owner@northwind.test` /
`Password123!`.

To run one app on its own, use `npm run dev:api` or `npm run dev:web`. For a
production run, `npm run build` then `npm start`. For the tests, `npm test` —
these need the separate `stockflow_test` database described in
[Quick start](#quick-start) step 2.

### On Windows

PowerShell has no `cp`, so copy the env files with:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

If `createdb` is not on `PATH`, call it from the PostgreSQL install directory
(e.g. `& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" stockflow`), or
create the database from pgAdmin.

This machine's PostgreSQL has no `postgres` database and uses `trust` auth for
`127.0.0.1`, so connect through `template1` with a literal `127.0.0.1` host:

```powershell
createdb -h 127.0.0.1 -U postgres --maintenance-db=template1 stockflow
```

and use a password-less, literal-IP `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/stockflow?schema=public"
```

---

## Quick start

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 14 or newer, running locally

### 1. Install dependencies

```bash
npm install
```

This is an npm workspaces monorepo, so one install covers both apps.

### 2. Create the databases

```bash
# Development database
createdb stockflow

# Separate database for the automated tests
createdb stockflow_test
```

Or from `psql`:

```sql
CREATE DATABASE stockflow;
CREATE DATABASE stockflow_test;
```

### 3. Configure the environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/api/.env` and set `DATABASE_URL` to your PostgreSQL connection
string, then generate a signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the result as `JWT_SECRET`. To run the test suite, create
`apps/api/.env.test` with the same shape but `DATABASE_URL` pointing at
`stockflow_test` and `NODE_ENV="test"`.

> `.env`, `.env.test`, and `.env.local` are gitignored. Only `.env.example`
> — which contains placeholders — is committed.

### 4. Run migrations and generate the client

```bash
npm run prisma:deploy     # apply migrations
npm run prisma:generate   # generate Prisma Client
```

For the test database:

```bash
cd apps/api
DATABASE_URL="postgresql://USER@localhost:5432/stockflow_test?schema=public" npx prisma migrate deploy
```

### 5. (Optional) Seed demo data

```bash
npm run seed --workspace=apps/api
```

Creates two organizations so isolation is visible immediately:

| Organization              | Login                  | Password       | Products | Default threshold |
| ------------------------- | ---------------------- | -------------- | -------- | ----------------- |
| Northwind Coffee Supply   | `owner@northwind.test` | `Password123!` | 15       | 10                |
| Harbor Outfitters         | `owner@harbor.test`    | `Password123!` | 3        | 5                 |

Both contain SKU `CPD-001`, demonstrating that SKUs are unique *per
organization* rather than globally.

### 6. Start the app

```bash
npm run dev
```

- Frontend — http://localhost:3000
- API — http://localhost:4000

Open http://localhost:3000, create an account, and you land on the dashboard.

### Production build

```bash
npm run build
npm start
```

### All commands

| Command                   | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Run API and frontend together                      |
| `npm run dev:api`         | API only (port 4000)                               |
| `npm run dev:web`         | Frontend only (port 3000)                          |
| `npm run build`           | Production build of both apps                      |
| `npm start`               | Run both production builds                         |
| `npm test`                | Run the API test suite                             |
| `npm run prisma:migrate`  | Create and apply a migration (development)         |
| `npm run prisma:deploy`   | Apply pending migrations (production)              |
| `npm run prisma:generate` | Regenerate Prisma Client                           |
| `npm run prisma:studio`   | Open Prisma Studio                                 |
| `npm run db:setup`        | Apply migrations then generate the client          |

---

## Architecture

```
D:\bhavana
├── apps
│   ├── api                       Express + TypeScript backend
│   │   ├── prisma
│   │   │   ├── schema.prisma     Models, indexes, constraints
│   │   │   ├── migrations/       Versioned SQL migrations
│   │   │   └── seed.ts           Demo data
│   │   ├── src
│   │   │   ├── app.ts            Express app assembly
│   │   │   ├── index.ts          Server entrypoint
│   │   │   ├── lib               env, prisma, jwt, password, errors, stock rules
│   │   │   ├── middleware        requireAuth, validate, centralized errors
│   │   │   └── modules           auth · products · dashboard · settings
│   │   └── tests                 60 integration tests against real PostgreSQL
│   └── web                       Next.js frontend
│       └── src
│           ├── app
│           │   ├── api/[...path] Server-side proxy to the API
│           │   ├── (auth)        login · signup
│           │   └── (app)         dashboard · products · settings
│           ├── components        ui/ · layout/ · products/ · dashboard/ · auth/
│           ├── lib               typed API client, formatting, types
│           └── middleware.ts     Frontend route guard
└── package.json                  npm workspaces root
```

### Why the frontend proxies the API

The browser never calls `localhost:4000` directly. Every request goes to the
Next.js route handler at `src/app/api/[...path]/route.ts`, which forwards it to
Express and relays `Set-Cookie` back. This means:

- the session cookie is same-origin, so there is no CORS or `SameSite` friction;
- `API_BASE_URL` stays server-side and never reaches the client bundle;
- in production the API can live on a private network.

### Layering

Routes handle HTTP, controllers unwrap the request, services own the data
access, and presenters shape the response. Services take `organizationId` as
their first parameter — supplied by the caller from the verified session — which
makes the tenant filter impossible to forget.

---

## Database schema

PostgreSQL with UUID primary keys, `numeric(12,2)` money, and `timestamptz`
timestamps. Tables and columns are snake_case; the Prisma models are camelCase
and mapped with `@map`.

### `organizations`

| Column                       | Type           | Notes                             |
| ---------------------------- | -------------- | --------------------------------- |
| `id`                         | `uuid`         | PK, generated                     |
| `name`                       | `varchar(255)` |                                   |
| `default_low_stock_threshold`| `integer`      | Default `10`                      |
| `created_at`                 | `timestamptz`  | Default `now()`                   |
| `updated_at`                 | `timestamptz`  | Maintained by Prisma `@updatedAt` |

### `users`

| Column            | Type           | Notes                                  |
| ----------------- | -------------- | -------------------------------------- |
| `id`              | `uuid`         | PK                                     |
| `name`            | `varchar(255)` |                                        |
| `email`           | `varchar(255)` | **UNIQUE**                             |
| `password`        | `varchar(255)` | bcrypt hash, cost 12                   |
| `organization_id` | `uuid`         | FK → `organizations.id`, `ON DELETE CASCADE` |
| `created_at`      | `timestamptz`  |                                        |
| `updated_at`      | `timestamptz`  |                                        |

Index on `organization_id`.

### `products`

| Column                | Type            | Notes                                        |
| --------------------- | --------------- | -------------------------------------------- |
| `id`                  | `uuid`          | PK                                           |
| `organization_id`     | `uuid`          | FK → `organizations.id`, `ON DELETE CASCADE` |
| `name`                | `varchar(255)`  |                                              |
| `sku`                 | `varchar(100)`  | Unique **per organization**                  |
| `description`         | `text`          | Nullable                                     |
| `quantity_on_hand`    | `integer`       | Default `0`, never negative                  |
| `cost_price`          | `numeric(12,2)` | Default `0` — exact decimal, not float       |
| `selling_price`       | `numeric(12,2)` | Default `0`                                  |
| `low_stock_threshold` | `integer`       | Nullable — `NULL` inherits the org default   |
| `last_stock_note`     | `varchar(500)`  | Nullable, from the latest adjustment         |
| `created_at`          | `timestamptz`   |                                              |
| `updated_at`          | `timestamptz`   |                                              |

Constraints and indexes:

```sql
UNIQUE (organization_id, sku)                   -- per-tenant SKU uniqueness
INDEX  (organization_id)                        -- tenant scans
INDEX  (organization_id, name)                  -- name search and sort
INDEX  (organization_id, quantity_on_hand)      -- low-stock queries
INDEX  (organization_id, created_at)            -- default list ordering
```

### Relationships

```
Organization 1 ──< n User       (cascade delete)
Organization 1 ──< n Product    (cascade delete)
```

Deleting an organization removes its users and products. There is no path that
deletes a product's organization out from under it.

### Migrations

A single migration, `prisma/migrations/20261103143735_init`, creates all three
tables with their constraints and indexes. Apply with `npm run prisma:deploy`
(production) or `npm run prisma:migrate` (development).

---

## API reference

Base URL `http://localhost:4000`, or `/api/*` through the frontend proxy.

Every response uses the same envelope:

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { ... } }

// failure
{ "success": false, "error": { "code": "DUPLICATE_SKU", "message": "...", "details": { "sku": "..." } } }
```

`details` is a `{ field: message }` map, which the forms use to place errors
next to the right input.

### Authentication

| Method | Endpoint         | Description                                    |
| ------ | ---------------- | ---------------------------------------------- |
| `POST` | `/auth/register` | Create an organization and its first user      |
| `POST` | `/auth/login`    | Sign in, sets the session cookie               |
| `POST` | `/auth/logout`   | Clear the session cookie                       |
| `GET`  | `/auth/me`       | Current user and organization *(protected)*    |

`POST /auth/register` takes `name`, `email`, `password`, `confirmPassword`, and
`organizationName`. The organization and user are created in one Prisma
transaction, so neither can exist without the other.

### Products *(all protected)*

| Method   | Endpoint               | Description                           |
| -------- | ---------------------- | ------------------------------------- |
| `GET`    | `/products`            | List: search, filter, sort, paginate  |
| `POST`   | `/products`            | Create                                |
| `GET`    | `/products/:id`        | Read one                              |
| `PATCH`  | `/products/:id`        | Update any subset of fields           |
| `DELETE` | `/products/:id`        | Delete                                |
| `PATCH`  | `/products/:id/stock`  | Atomic stock adjustment               |

`GET /products` query parameters:

| Parameter   | Values                                                                        | Default     |
| ----------- | ----------------------------------------------------------------------------- | ----------- |
| `search`    | Matches name **or** SKU, case-insensitive                                     | —           |
| `status`    | `ALL` · `IN_STOCK` · `LOW_STOCK` · `OUT_OF_STOCK`                             | `ALL`       |
| `page`      | ≥ 1                                                                           | `1`         |
| `pageSize`  | 1–100                                                                         | `10`        |
| `sortBy`    | `name` · `sku` · `quantityOnHand` · `sellingPrice` · `costPrice` · `createdAt` · `updatedAt` | `createdAt` |
| `sortOrder` | `asc` · `desc`                                                                | `desc`      |

Returns `meta.pagination` with `page`, `pageSize`, `total`, `totalPages`,
`hasPreviousPage`, `hasNextPage`.

`PATCH /products/:id/stock` body:

```jsonc
{
  "type": "increase" | "decrease" | "set",
  "quantity": 10,
  "note": "Received PO #1042"   // optional
}
```

### Dashboard *(protected)*

| Method | Endpoint                 | Description                                   |
| ------ | ------------------------ | --------------------------------------------- |
| `GET`  | `/dashboard/summary`     | Totals, low-stock and out-of-stock counts     |
| `GET`  | `/dashboard/low-stock`   | Products at or below threshold (`?limit=50`)  |

### Settings *(protected)*

| Method  | Endpoint    | Description                                              |
| ------- | ----------- | -------------------------------------------------------- |
| `GET`   | `/settings` | Organization profile and counts                          |
| `PATCH` | `/settings` | Update `name` and/or `defaultLowStockThreshold`           |

### Status codes

| Code  | Meaning                                                      |
| ----- | ------------------------------------------------------------ |
| `200` | Success                                                      |
| `201` | Created                                                      |
| `400` | Invalid operation (e.g. stock would go negative)             |
| `401` | Missing, invalid, or expired session                         |
| `404` | Not found — **also** returned for another tenant's resource   |
| `409` | Conflict (`DUPLICATE_SKU`, `EMAIL_TAKEN`)                    |
| `422` | Validation failure, with per-field `details`                 |
| `429` | Rate limited (auth endpoints)                                |
| `500` | Unexpected error — generic message, details stay server-side |
| `503` | Database unavailable                                         |

---

## Environment variables

### `apps/api/.env`

| Variable         | Required | Default                 | Description                                  |
| ---------------- | -------- | ----------------------- | -------------------------------------------- |
| `DATABASE_URL`   | **yes**  | —                       | PostgreSQL connection string                 |
| `JWT_SECRET`     | **yes**  | —                       | Token signing secret, min 16 chars           |
| `JWT_EXPIRES_IN` | no       | `7d`                    | Session lifetime                             |
| `NODE_ENV`       | no       | `development`           | `development` · `test` · `production`        |
| `PORT`           | no       | `4000`                  | API port                                     |
| `COOKIE_NAME`    | no       | `stockflow_token`       | Session cookie name                          |
| `COOKIE_SECURE`  | no       | `false`                 | Set `true` when serving over HTTPS           |
| `BCRYPT_ROUNDS`  | no       | `12`                    | bcrypt cost factor (10–15)                   |
| `CORS_ORIGIN`    | no       | `http://localhost:3000` | Comma-separated allowed origins              |

### `apps/web/.env.local`

| Variable       | Required | Default                 | Description                          |
| -------------- | -------- | ----------------------- | ------------------------------------ |
| `API_BASE_URL` | no       | `http://localhost:4000` | API base URL used by the proxy (server-side only) |

Configuration is validated with Zod at startup, so a missing or malformed value
fails immediately with a clear message rather than at the first request. Error
output names the offending variables, never their values.

---

## How tenant isolation is enforced

Four layers, each independent:

1. **The tenant comes from the token, never the request.** `organizationId` is
   embedded in the JWT at sign-in. `requireAuth` verifies the token *and*
   re-reads the user from the database on every request, so a deleted user or a
   stale token stops working immediately.

2. **Validation strips unknown fields.** Zod schemas discard anything not
   declared, so an `organizationId` in a request body is gone before a handler
   sees it. A test asserts that posting another tenant's `organizationId` still
   creates the product in the caller's organization.

3. **Every query is scoped.** Services take `organizationId` as their first
   argument and include it in the `where` clause. Writes use `updateMany` /
   `deleteMany` with both `id` and `organizationId`, so the tenant filter is
   part of the SQL `WHERE` rather than an application-level check.

4. **Cross-tenant access returns 404, not 403.** A valid id belonging to another
   organization is indistinguishable from one that does not exist, so the API
   cannot be used to probe for the existence of other tenants' data.

Verified end-to-end: a second organization receives `404` when attempting to
read, update, delete, or adjust stock on another tenant's product, and the
record is confirmed unchanged afterwards.

---

## How concurrent stock updates stay correct

A read-then-write (`SELECT`, compute, `UPDATE`) loses updates when two requests
interleave. Relative adjustments instead use a single conditional statement:

```sql
UPDATE products
   SET quantity_on_hand = quantity_on_hand + $delta
 WHERE id = $id
   AND organization_id = $org
   AND quantity_on_hand >= $amount   -- only present when decrementing
```

PostgreSQL evaluates this atomically and row-locks the product, so there is no
window between reading and writing. The `quantity_on_hand >= $amount` guard
means a request that would drive stock negative matches no rows and is reported
as a `400` rather than silently clamping.

Three tests cover this:

- 20 concurrent decrements of 5 against a stock of 100 → exactly `0`
- 25 concurrent increments of 2 against a stock of 0 → exactly `50`
- 10 concurrent decrements of 3 against a stock of 10 → exactly 3 succeed,
  7 are rejected, final quantity `1`, never negative

---

## Low-stock rules

```
effective threshold = product.lowStockThreshold ?? organization.defaultLowStockThreshold

OUT_OF_STOCK   quantityOnHand = 0
LOW_STOCK      quantityOnHand ≤ effective threshold  (and > 0)
IN_STOCK       otherwise
```

Out-of-stock is evaluated first, so a zero-quantity product is never reported
merely as "low".

The organization default is resolved **at query time** via
`COALESCE(low_stock_threshold, <org default>)`, never copied onto products.
Changing the default in Settings therefore re-classifies every inheriting
product immediately, with no backfill.

The dashboard's two cards are deliberately mutually exclusive so nothing is
double-counted: **Low stock** counts `quantity > 0 AND quantity ≤ threshold`,
**Out of stock** counts `quantity = 0`. The *Needs restocking* table is broader
— it lists everything at or below the threshold, including zero-quantity
products, and distinguishes them through its Stock Status column.

All dashboard figures are computed by PostgreSQL in one organization-scoped
aggregate query rather than by loading rows into Node.

---

## Testing

```bash
npm test
```

60 integration tests run against a real PostgreSQL database (`stockflow_test`),
exercising the full HTTP stack through Supertest. The suite refuses to start if
`DATABASE_URL` does not point at a database named `stockflow_test`, so it can
never truncate development data.

| File               | Tests | Covers                                                     |
| ------------------ | ----- | ---------------------------------------------------------- |
| `auth.test.ts`     | 9     | Registration, transactional org creation, password hashing, login/logout, duplicate email, tampered tokens, protected endpoints |
| `products.test.ts` | 20    | CRUD, decimal precision, duplicate SKU within/across orgs, search, sorting, pagination, status filter, validation |
| `stock.test.ts`    | 11    | Increase, decrease, set, notes, negative-stock rejection, three concurrency scenarios |
| `tenancy.test.ts`  | 11    | Cross-tenant read/update/delete/stock denial, spoofed `organizationId`, scoped dashboard and settings, cascade deletes |
| `dashboard.test.ts`| 9     | Summary accuracy, threshold precedence, low-stock ordering, settings updates affecting calculations |

### Verification performed

| # | Scenario                                             | Result |
| - | ---------------------------------------------------- | ------ |
| 1 | User can register                                    | Pass   |
| 2 | Organization created automatically                   | Pass   |
| 3 | User can log in and log out                          | Pass   |
| 4 | User can create products                             | Pass   |
| 5 | User can view products                               | Pass   |
| 6 | User can update products                             | Pass   |
| 7 | User can delete products                             | Pass   |
| 8 | Duplicate SKU rejected within an organization        | Pass   |
| 9 | Identical SKUs allowed across organizations          | Pass   |
| 10| Stock quantity updates correctly                     | Pass   |
| 11| Negative quantities rejected                         | Pass   |
| 12| Low-stock calculations correct                       | Pass   |
| 13| Dashboard statistics accurate                        | Pass   |
| 14| Organization default threshold works                 | Pass   |
| 15| Organization settings can be updated                 | Pass   |
| 16| User A cannot access User B's data                   | Pass   |
| 17| Unauthenticated users blocked from protected routes  | Pass   |
| 18| Concurrent stock updates stay correct                | Pass   |

Both production builds pass: `tsc` for the API, `next build` for the ten
frontend routes.

---

## Security

- Passwords hashed with bcrypt (cost 12); plaintext is never stored, logged, or
  returned. A test asserts the response body cannot contain the password and
  that the stored value matches the bcrypt format.
- JWT in an `httpOnly`, `sameSite=lax` cookie, `secure` over HTTPS — out of
  reach of page JavaScript. A `Bearer` header is also accepted for non-browser
  clients.
- Login returns one message for both an unknown email and a wrong password, and
  spends the same hashing time either way, so the endpoint cannot be used to
  enumerate accounts.
- All input validated with Zod; unknown fields stripped.
- All queries go through Prisma's parameterized APIs. The few raw SQL queries
  (aggregates needing `COALESCE` across columns) use `Prisma.sql` tagged
  templates, which parameterize interpolated values rather than concatenating
  them.
- Centralized error handler: unrecognised errors are logged server-side and
  returned as a generic 500. Prisma initialization errors are never forwarded,
  since their messages contain the connection string.
- `helmet` security headers; rate limiting on the credential endpoints.
- Secrets read only from the environment; `.env` files gitignored.

---

## Limitations

- **No browser-driven UI verification.** The Chrome extension was not connected
  during this build, so the UI was verified at the HTTP level — real frontend
  routes, middleware redirects, the proxy, cookie relay, and every CRUD/stock/
  isolation flow through `localhost:3000` — but not by clicking through pages
  and comparing screenshots. The flows are confirmed working; the visuals are
  unverified.
- **No automated frontend tests.** The 60 tests cover the API. Component and
  end-to-end browser tests are not included.
- **`bcryptjs` rather than native `bcrypt`.** Same bcrypt algorithm and hash
  format, chosen because it is pure JavaScript and needs no native build
  toolchain. It is slower than the native binding at equal cost factors; on a
  high-traffic deployment prefer native `bcrypt` or `argon2`.
- **No role-based access control.** Every user in an organization has identical
  permissions — the Settings page is editable by any member, not just an owner.
  This matches the MVP scope.
- **The status filter resolves ids in a separate query.** Filtering the product
  list by stock status runs a scoped `SELECT id` and feeds the result into the
  main query. Correct and index-backed, but it would need folding into a single
  statement for very large catalogs.
- **Local PostgreSQL uses `trust` auth.** This machine's `pg_hba.conf` has
  `host all all 127.0.0.1/32 trust`, so any local process can connect as any
  role without a password. Fine for a single-user dev box; change it to
  `scram-sha-256` on anything shared.
- **Cookie settings assume same-site deployment.** `sameSite=lax` works because
  the proxy keeps requests same-origin. Serving the frontend and API from
  different registrable domains would require `sameSite=none; secure`.
- Out of scope by design: multi-warehouse, variants, categories, images,
  external integrations, orders, purchase orders, suppliers, CSV import,
  billing, email notifications, and stock movement history.
=======
# Saas1
>>>>>>> 1501788dcfd827bfac04666403299b7d2c794bdf
