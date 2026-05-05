# Workspace

## Overview

pnpm workspace monorepo. Contains the **Budgetarian** personal finance app — a full-featured finance tracker with expense logging, savings goals, paylater/installment tracking, warranty keeper with receipt uploads, money-saving tips, and a dashboard summary.

## Stack

- **Monorepo tool**: pnpm workspaces + Node.js 24
- **Frontend**: React + Vite (Tailwind, shadcn/ui, Recharts, Wouter)
- **Auth**: Clerk (`@clerk/react` frontend, JWT/JWKS verification in Java backend)
- **Backend**: Java 19 + Spring Boot 3.2 + Spring JDBC (JdbcTemplate)
- **Database**: PostgreSQL (accessed via `DATABASE_URL` env var)
- **Object Storage**: Replit Object Storage / GCS (for warranty receipt uploads)

## Artifacts

- **`artifacts/budgetarian`** — React+Vite frontend, served at `/`
- **`artifacts/java-api`** — Spring Boot 3.2 REST API backend (replaces former Node.js api-server)
- **`artifacts/api-server`** — artifact shell whose workflow now runs the Java server

## Key Pages (frontend)

- `/` — Landing page (signed-out) / redirect to dashboard (signed-in)
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/dashboard` — Financial overview: spending chart, stats, recent expenses, alerts
- `/expenses` — Expense log with add/delete and category filtering
- `/goals` — Savings goals with progress bars and saved amount updates
- `/installments` — Paylater/installment tracker with due-date alerts and mark-as-paid
- `/warranties` — Warranty keeper with receipt image upload
- `/tips` — Money-saving tips and income ideas with category tabs

## API Routes (Java backend — context path `/api`)

- `GET/POST /api/expenses`, `GET /api/expenses/summary`, `GET|PATCH|DELETE /api/expenses/:id`
- `GET/POST /api/goals`, `PATCH|DELETE /api/goals/:id`
- `GET/POST /api/installments`, `GET /api/installments/upcoming`, `PATCH|DELETE /api/installments/:id`
- `GET/POST /api/warranties`, `GET /api/warranties/expiring-soon`, `PATCH|DELETE /api/warranties/:id`
- `GET /api/tips` (no auth)
- `GET /api/dashboard/summary`
- `POST /api/storage/uploads/request-url`, `GET /api/storage/objects/**`, `GET /api/storage/public-objects/**`
- `GET /api/healthz`

## DB Schema

Tables in PostgreSQL: `expenses`, `goals`, `installments`, `warranties`
Schema source of truth: `lib/db/src/schema/`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `mvn -f artifacts/java-api/pom.xml spring-boot:run` — run Java API locally
- `mvn -f artifacts/java-api/pom.xml compile` — compile Java sources
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec

## Architecture decisions

- Java backend uses `INSERT ... RETURNING *` with PostgreSQL for all mutations
- Clerk JWT verification uses JWKS derived from `VITE_CLERK_PUBLISHABLE_KEY` env var (base64-decoded to get domain)
- Object storage ACL policy stored in GCS object custom metadata under key `custom:aclPolicy`
- GCS client configured with Replit sidecar external-account credentials (`http://127.0.0.1:1106`)
- Spring `server.servlet.context-path=/api` so controllers map paths without `/api` prefix

## User preferences

- Backend should be Java (Spring Boot), not Node.js/Express

## Gotchas

- Workflow for api-server runs from `artifacts/api-server/` dir — use absolute path for Maven: `mvn -f /home/runner/workspace/artifacts/java-api/pom.xml ...`
- Spring Boot interceptor path patterns are relative to context path (omit `/api` prefix)
- Maven downloads deps on first run — startup takes ~60s initially, then fast from cache
