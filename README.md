# Personal Finance App

A modern, full-stack personal finance application for tracking income and expenses, organizing spending by category, setting monthly budgets, and exporting financial reports. The application is multi-tenant, providing secure, isolated data for each user.

---

## Features

### Implemented

**Authentication & security**
- User registration and login with JWT access tokens and httpOnly refresh-token cookies
- Google OAuth sign-in
- Two-factor authentication (TOTP) with encrypted secrets
- Password change, profile management, and route protection via Next.js middleware

**Financial data**
- **Transactions** — Create, read, update, and delete income, expense and transfer entries with dates, notes, categories and accounts. Transfers move money between your own accounts (into savings, investments or onto a card) and never count as income or spending
- **Categories** — Custom income and expense categories with colors and icons (managed in Settings). Expense categories are marked need/want and fixed/variable and can count toward ratios such as housing or debt interest; income categories are marked active, passive or portfolio
- **Budgets** — Monthly budget limits per category (API ready; UI page is a placeholder)
- **Accounts** — Bank, cash, mobile wallet, savings, investment, retirement and property assets plus credit cards and loans, with balances, a six-month trend, net worth and money available to spend. Archive (zero balance) or delete (unused) accounts
- **Account setup** — Default-account opening balance, low-balance threshold, and savings-sector allocations
- **Calculations** — Monthly, quarterly, and yearly summaries, category breakdowns, and where each month's surplus went (savings, investments, debt) for the dashboard
- **Reports** — CSV and PDF export for any date range in the user's currency, with preview and local download history
- **Currency & number format** — Any ISO 4217 currency and a choice of number grouping (including lakh/crore); money is stored as 64-bit minor units
- **Financial profile** — Income stability (with a suggestion from recent income), dependents, insurance and employer match, plus retirement assumptions, used to tailor targets and advice

**Frontend**
- **Dashboard** — Monthly, quarterly, and yearly views with Recharts visualizations
- **Transactions** — Paginated ledger with filters and modal create/edit forms
- **Reports** — Date-range picker, format selection, and one-click downloads
- **Settings** — Profile, security (2FA), preferences (appearance, currency, timezone), financial profile, categories, and account configuration
- **Landing page** — Marketing home page with links to auth flows

**Platform**
- PostgreSQL schema and Drizzle migrations (users, categories, transactions, budgets, account config, savings sectors, refresh tokens)
- Standardized API responses, validation, logging, request IDs, and global error handling
- Swagger/OpenAPI docs at `/api/docs` (enabled in development; set `ENABLE_SWAGGER=true` in production to expose)
- Rate limiting via `@nestjs/throttler` with optional Redis-backed storage
- Local infrastructure via Docker Compose (PostgreSQL and Redis)

### Planned / in progress

- **Budgets UI** — Backend endpoints exist; the `/budgets` page still needs a full interface
- **Roadmap** — Funded goals, recurring transactions and financial-health insights; see [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
- Additional polish, tests, and production hardening

---

## Tech Stack

**Frontend** ([`frontend/`](./frontend))
- Framework: **Next.js 15** (React 19, App Router)
- Styling: **Tailwind CSS v4** (Carbon-inspired design system)
- State & data fetching: **TanStack React Query v5**
- Forms & validation: **React Hook Form** + **Zod**
- UI & charts: **Lucide React** + **Recharts**

**Backend** ([`backend/`](./backend))
- Framework: **NestJS 11** (Node.js 20+)
- Language: **TypeScript**
- Database: **PostgreSQL 16**
- ORM: **Drizzle ORM**
- Validation: `class-validator` & `class-transformer`
- Security: Helmet, CORS, bcrypt, JWT, cookie-based refresh tokens
- Docs: **Swagger** via `@nestjs/swagger`
- Reports: **@react-pdf/renderer**, **fast-csv**

**Infrastructure**
- **Docker**: Docker Compose runs the complete stack (Next.js, NestJS, PostgreSQL, and Redis)
- **Production**: Frontend on **Vercel**, backend on **Render**, database on **Neon** (PostgreSQL)

---

## Repository Structure

```text
PF/
├── backend/                # NestJS REST API, Drizzle schema, and migrations
├── frontend/               # Next.js client app (App Router)
├── docker-compose.yml      # Local PostgreSQL and Redis
├── ARCHITECTURE.md         # System architecture and design patterns
├── DESIGN.md               # UI/design system notes
├── WIKI.md                 # Extended project documentation
└── README.md               # This file
```

---

## Run without Docker (development)

## Run the complete app with Docker

Install Docker Desktop, then from the repository root copy the Docker environment
template and start the stack:

```bash
cp .env.example .env
docker compose up --build
```

On PowerShell, use `Copy-Item .env.example .env` for the first command. Change the
placeholder secrets in `.env` before using the app outside local development. The
Docker setup runs database migrations automatically, and persists database and Redis
data in named Docker volumes.

- App: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- API docs: `http://localhost:3001/api/docs`

To stop the stack, run `docker compose down`. Add `-v` only when you deliberately
want to remove the persisted local database and Redis data.

### 1. Start infrastructure

From the repository root, start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

### 2. Run the backend API

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run start:dev
```

The API listens at `http://localhost:3001/api/v1`. Interactive API docs are at `http://localhost:3001/api/docs`.

Set `FRONTEND_URL` in `backend/.env` to match your frontend origin (default Next.js dev server: `http://localhost:3000`).

### 3. Run the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The UI is available at `http://localhost:3000`.

Browser requests go to `/api/v1` on the frontend origin. Next.js rewrites those calls to the backend (`API_PROXY_TARGET`, default `http://localhost:3001/api/v1`), keeping the `refresh_token` cookie first-party so middleware can read it.

---

## Deployment

Production is split across three managed services:

| Component | Platform | Description |
|-----------|----------|-------------|
| **Frontend** | [Vercel](https://vercel.com) | Next.js app — deploy from the `frontend/` directory |
| **Backend** | [Render](https://render.com) | NestJS API — web service with secrets and DB connection env vars |
| **Database** | [Neon](https://neon.tech) | Serverless PostgreSQL — connection string provided to Render |

**Backend (Render)**
- Set `DATABASE_URL` to your Neon connection string
- Configure `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, `FRONTEND_URL` (your Vercel domain), and `BACKEND_URL` (your Render service URL)
- Optionally set `REDIS_URL` for distributed rate limiting and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` for OAuth

**Frontend (Vercel)**
- Route browser API calls through the frontend origin so the `refresh_token` is a first-party cookie that Next.js middleware can read
- Set `NEXT_PUBLIC_API_URL=/api/v1`
- Set the server-only `API_PROXY_TARGET=https://<your-render-service>.onrender.com/api/v1`
- Do **not** point `NEXT_PUBLIC_API_URL` directly at Render

**Local vs production**
- Local development uses Docker Compose for Postgres and Redis; production uses Neon instead of a self-hosted database
- Redis is optional locally but recommended in production for consistent rate limiting across instances

---

## Documentation

| Document | Contents |
|----------|----------|
| [WIKI.md](./WIKI.md) | Data model, API conventions, and project overview |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Client/server architecture, modules, and security flow |
| [DESIGN.md](./DESIGN.md) | Carbon-inspired UI design system |
| [backend/README.md](./backend/README.md) | Backend setup, env vars, database scripts, and API details |

For live endpoint reference during development, open `http://localhost:3001/api/docs` after starting the backend.
