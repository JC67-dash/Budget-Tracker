# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **Budgetarian** personal finance app — a full-featured finance tracker with expense logging, savings goals, paylater/installment tracking, warranty keeper with receipt uploads, money-saving tips, and a dashboard summary.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Frontend**: React + Vite (Tailwind, shadcn/ui, Recharts, Wouter)
- **Auth**: Clerk (via `@clerk/react` on frontend, `@clerk/express` on backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Object Storage**: Replit Object Storage (for warranty receipt uploads)
- **Build**: esbuild (CJS bundle)

## Artifacts

- **`artifacts/budgetarian`** — React+Vite frontend, served at `/`
- **`artifacts/api-server`** — Express 5 REST API backend, served at `/api`

## Key Pages (frontend)

- `/` — Landing page (signed-out) / redirect to dashboard (signed-in)
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/dashboard` — Financial overview: spending chart, stats, recent expenses, alerts
- `/expenses` — Expense log with add/delete and category filtering
- `/goals` — Savings goals with progress bars and saved amount updates
- `/accounts` — Money accounts (digital wallets, banks, cash) with per-account balances and total
- `/installments` — Paylater/installment tracker with due-date alerts and mark-as-paid
- `/debts` — Debt tracker (loans owed) with overdue interest, mark-as-paid, debt-free banner
- `/warranties` — Warranty keeper with receipt image upload
- `/tips` — Money-saving tips and income ideas with category tabs

## API Routes (backend)

- `GET/POST /api/expenses` — list/create expenses
- `GET /api/expenses/summary` — category breakdown
- `PATCH/DELETE /api/expenses/:id` — update/delete
- `GET/POST /api/goals` — list/create goals
- `PATCH/DELETE /api/goals/:id` — update/delete
- `GET/POST /api/installments` — list/create installments
- `GET /api/installments/upcoming` — due within 7 days
- `PATCH/DELETE /api/installments/:id` — update/delete
- `GET/POST /api/debts` — list/create debts
- `PATCH/DELETE /api/debts/:id` — update/delete
- `GET/POST /api/accounts` — list/create money accounts
- `PATCH/DELETE /api/accounts/:id` — update/delete
- `GET/POST /api/warranties` — list/create warranties
- `GET /api/warranties/expiring-soon` — expiring within 30 days
- `PATCH/DELETE /api/warranties/:id` — update/delete
- `GET /api/tips` — list tips (seeded)
- `GET /api/dashboard/summary` — all summary stats combined
- `POST /api/storage/uploads/request-url` — presigned upload URL
- `GET /api/storage/*` — serve stored files

## DB Schema (lib/db/src/schema/index.ts)

Tables: `expenses`, `goals`, `installments`, `warranties`, `debts`, `accounts`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
