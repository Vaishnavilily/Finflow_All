# Finflow Database Scheme

This repository contains three applications, each backed by MongoDB:

- `Gateway` (authentication and user bootstrap)
- `personal` (personal finance)
- `finflow_sme` (SME accounting and operations)

All services use `MONGODB_URI` and connect to a MongoDB database (default `finflow` in `Gateway`).

## 1) Gateway Database (`users` collection)

### Collection: `users`

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Mongo primary key |
| `email` | String | Yes | Stored normalized (lowercase/trimmed in API) |
| `password` | String | Yes | Hashed using bcrypt |
| `name` | String | Yes | User display name |
| `plan` | String | No | Default: `individual` |
| `status` | String | No | Default: `active` |
| `createdAt` | Date | Yes | Set on insert |
| `updatedAt` | Date | Yes | Set on insert/update |

Recommended index:

- Unique index on `email`
- In this project, uniqueness is enforced per use case by separate collections:
  - `individual_users` has unique `email`
  - `sme_users` has unique `email`
  - The same email can exist once in each collection, but not duplicated within the same collection

## 2) Personal Database Collections

### Collection: `users`

| Field | Type | Required | Notes |
|---|---|---|---|
| `authId` | String | Yes | Unique auth provider identity |
| `name` | String | No | Profile name |
| `email` | String | No | Lowercased/trimmed, sparse unique |
| `phone` | String | No | Profile phone |
| `dob` | Date | No | Date of birth |
| `city` | String | No | User city |
| `occupation` | String | No | User occupation |
| `annualIncome` | Number | No | Defaults to `0` |
| `plan` | String | No | Default: `Individual` |
| `status` | Enum | No | `active` / `inactive` |
| `lastLoginAt` | Date | No | Updated on profile GET |
| `budgets` | ObjectId[] | No | Legacy references |
| `goals` | ObjectId[] | No | Legacy references |
| `transactions` | ObjectId[] | No | Legacy references |

Indexes:

- Unique index: `authId`
- Sparse unique index: `email`

### Collection: `transactions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `ownerAuthId` | String | Yes | Ownership boundary |
| `date` | Date | Yes | Default: now |
| `description` | String | Yes | Trimmed |
| `category` | String | Yes | Trimmed |
| `amount` | Number | Yes | `>= 0` |
| `type` | Enum | Yes | `income` / `expense` |
| `createdAt` | Date | Yes | Auto timestamp |
| `updatedAt` | Date | Yes | Auto timestamp |

Indexes:

- `ownerAuthId`
- Compound: `{ ownerAuthId: 1, date: -1 }`

### Collection: `budgets`

| Field | Type | Required | Notes |
|---|---|---|---|
| `ownerAuthId` | String | Yes | Ownership boundary |
| `category` | String | Yes | Trimmed |
| `limit` | Number | Yes | `>= 0` |
| `spent` | Number | No | Default: `0`, `>= 0` |
| `alertThreshold` | Number | No | Default: `80`, range `0..100` |
| `month` | String | No | Format `YYYY-MM` |

Indexes:

- `ownerAuthId`
- Unique compound: `{ ownerAuthId: 1, month: 1, category: 1 }`

### Collection: `goals`

| Field | Type | Required | Notes |
|---|---|---|---|
| `ownerAuthId` | String | Yes | Ownership boundary |
| `name` | String | Yes | Trimmed |
| `targetAmount` | Number | Yes | `>= 0.01` |
| `currentAmount` | Number | No | Default: `0`, `>= 0` |
| `deadline` | Date | No | Optional |
| `category` | String | No | Default: `Savings` |

Indexes:

- `ownerAuthId`
- Compound: `{ ownerAuthId: 1, createdAt: -1 }`

## 3) SME Database Collections

### Core master data

- `accounts`: chart of accounts (`code`, `name`, `type`, `balance`, `description`)
- `customers`: customer profile and rollup spend (`name`, `email`, `status`, `totalBilled`)
- `vendors`: vendor profile and rollup spend (`name`, `email`, `status`, `totalSpent`)
- `settings`: singleton company settings (`companyName`, `email`, `currency`, `timezone`, `theme`)

### Financial documents

- `transactions`: operational ledger transactions (`date`, `description`, `amount`, `type`, reconciliation state)
- `invoices`: AR documents with line items (`invoiceNumber`, customer, `items[]`, `subtotal`, `taxRate`, `taxAmount`, `total`, `status`)
- `bills`: AP documents with line items (`billNumber`, vendor, `items[]`, `subtotal`, `taxRate`, `taxAmount`, `total`, `status`)
- `estimates`: quote documents with line items (`estimateNumber`, customer, `items[]`, `subtotal`, `total`, `status`)

### Banking and payouts

- `bankconnections`: connected bank account metadata (`bankName`, `accountName`, `accountMask`, `status`, `balance`, `lastSync`)
- `payouts`: outbound sweep/payment records (`amount`, `destinationBank`, `accountMask`, `reference`, `status`, `expectedArrival`)

### Integrity rules now enforced in API/model layer

- Numeric money fields are normalized to 2 decimals before writes.
- `items[].amount` is auto-derived from `quantity * price`.
- Document totals are recalculated server-side (`subtotal`, `taxAmount`, `total`) for invoices/bills/estimates.
- String identifiers and contact fields are trimmed; emails are lowercased.
- Invalid updates are rejected using Mongoose validators (`runValidators: true` on updates).
- ID route handlers consistently use `params` directly and return 404 on missing records.

## 4) Relationship Overview

- `personal.users.authId` is the ownership key for `personal.transactions`, `personal.budgets`, and `personal.goals`.
- Legacy object-id arrays on `personal.users` are still supported and cleaned up when child records are deleted.
- SME module is currently modeled as a single-tenant workspace (no tenant key yet). If multi-tenant support is needed, add `tenantId` to all SME collections and create compound tenant-scoped unique indexes.

## 5) Recommended Operational Checks

- Run `db.collection.getIndexes()` in each collection and confirm expected unique/compound indexes.
- Add migration/backfill scripts for existing records that may violate new validation rules.
- Add integration tests for:
  - duplicate budget insert in same month/category
  - invoice/bill total recomputation
  - update rejection for invalid numeric payloads
  - ownership-safe CRUD in personal APIs

## 6) New User Initialization Rules

- New users created from `Gateway` start with no financial records in `personal` and `finflow_sme`.
- SME settings are no longer auto-created with placeholder company/email values.
- Personal profile records are created with identity only (`authId` + timestamps); profile fields remain empty until the user submits them.
- Personal dashboard no longer shows sample seeded values when there is no real data.
