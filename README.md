# Peoplify Server

HR management platform API — organizations, departments, employees, and leave requests, built with NestJS 11, Prisma 7, and PostgreSQL.

## Tech stack

- **Framework:** NestJS 11 (Express)
- **Database:** PostgreSQL via Prisma 7 (driver adapter: `@prisma/adapter-pg`)
- **Auth:** JWT (Passport) with role-based + organization-scoped authorization
- **Docs:** Swagger / OpenAPI, auto-generated from decorators
- **Tests:** Jest (unit) + Jest/Supertest (e2e)

## Getting started

### Run with Docker (recommended)

```bash
docker compose up -d --build
```

This starts Postgres and the API together. The API listens on `http://localhost:3000` by default (configurable via `PORT`). On first boot the container applies the Prisma schema automatically (`prisma db push`, or `prisma migrate deploy` once a `prisma/migrations` directory exists).

### Run locally (without Docker)

```bash
npm install
npx prisma generate
npx prisma db push          # requires DATABASE_URL pointing at a reachable Postgres
npm run start:dev
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Key variables:

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | e.g. `postgresql://user:pass@localhost:5432/peoplify?schema=public` |
| `PORT` | API port | Defaults to `3000` |
| `JWT_SECRET` | JWT signing secret | **Must be set to a real secret outside local dev** — docker-compose falls back to an insecure default (`dev-secret-change-me`) if unset |
| `JWT_EXPIRES_IN` | Access token lifetime | Defaults to `1d` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Only used by `docker-compose.yml` to configure the `db` service | |

## API documentation

Once running, the full live API reference is available at:

- **Swagger UI:** `GET /api/docs`
- **OpenAPI JSON:** `GET /api/docs-json`
- **OpenAPI YAML:** `GET /api/docs-yaml`

A static snapshot is also committed at [`openapi.yaml`](openapi.yaml) for frontend codegen — refresh it after backend changes with:

```bash
curl -s http://localhost:3000/api/docs-yaml -o openapi.yaml
```

## Authentication & authorization

- Every endpoint except `POST /auth/login` requires `Authorization: Bearer <token>`.
- Three roles: `ADMIN` (platform staff, unrestricted across all organizations), `HR_MANAGER`, `EMPLOYEE` (both confined to their own organization — currently identical permissions to each other).
- Non-admin users are scoped to their own organization on every resource; reaching for another org's data returns `404` (existence isn't leaked via `403`).
- Organization-level actions (create/list/delete organizations, changing the default org) are `ADMIN`-only.

See inline Swagger docs (`/api/docs`) for the full per-endpoint authorization and validation rules.

## Modules

| Module | Routes | Notes |
|---|---|---|
| `auth` | `/auth/login` | Issues JWTs against `User` records (bcrypt password check) |
| `organization` | `/organizations` | Top-level tenant; branding, default-org fallback |
| `department` | `/departments` | Org-scoped; optional manager assignment (one department per manager) |
| `employee` | `/employees` (+ `/contracts`, `/documents` sub-resources) | Core HR profile: status, employment type, salary, manager, department |
| `leave-request` | `/leave-requests` | Submit / list / cancel; approval workflow not yet implemented |

## Testing

```bash
npm test                    # unit tests
npm run test:cov            # unit tests with coverage

# e2e tests need a reachable Postgres and a JWT_SECRET:
DATABASE_URL="postgresql://peoplify:peoplify@localhost:5432/peoplify?schema=public" \
JWT_SECRET=test-secret \
npm run test:e2e
```

`test/authorization.e2e-spec.ts` boots the full app and verifies guard/role/org-scoping enforcement over real HTTP requests — the one place that actually proves route decorators are wired correctly, since unit-level controller specs bypass guards entirely.

## Seeding

```bash
npm run db:seed
```

Creates a default organization (`Staffly`) and two users (`htetlinnoo19@gmail.com` / `ADMIN`, `test@gmail.com` / `HR_MANAGER`), password `asdf1234` for both. Safe to re-run — it upserts rather than duplicating.

## Known gaps

- No self-service user registration endpoint — accounts beyond what the seed script creates must be provisioned directly in the database today.
- Leave request approval/rejection isn't implemented yet — only submit, list, and cancel.
- `Position` has a Prisma model but no API — don't build UI against `positionId` yet.
