# SplitReceipt

> A full-stack bill-splitting app that calculates what each person actually owes—not just an equal share.

[![CI](https://github.com/sulzeu/splitr/actions/workflows/ci.yml/badge.svg)](https://github.com/sulzeu/splitr/actions/workflows/ci.yml)

SplitReceipt helps a group turn a receipt into a transparent split. Add people and items, assign items to one or more people, and calculate totals including GST, tips, and service fees. Bills can be shared by join code, and receipt photos can be used to speed up item entry.

**Project status:** In development. The application is not currently deployed as a public demo.

## Highlights

- **Cent-exact calculations:** distributes item costs and shared charges using a largest-remainder approach so allocated amounts reconcile to the bill total.
- **Flexible item assignment:** supports individual and shared items rather than assuming every person owes the same amount. Prices are per unit, and receipt quantities become separate assignable items.
- **Full bill lifecycle:** create or join bills, add people and items, assign items, review the split, track settlement, and revisit bill history.
- **Receipt extraction:** integrates a locally run vision-language model to extract line items from receipt photos, with manual entry available.
- **Backend-owned state and calculations:** Express services and repositories keep persistence and business rules out of the UI.
- **Automated quality checks:** CI runs linting, formatting, tests with coverage floors, and production builds for both app layers.

## Product flow

1. Create a bill or join one with a code.
2. Add the people sharing the bill.
3. Add receipt items manually or import a receipt image.
4. Assign each item to the people who ordered it.
5. Review per-person totals, account for extra charges, and track who has paid.

## Technology

| Area               | Technologies                                                         |
| ------------------ | -------------------------------------------------------------------- |
| Frontend           | React, TypeScript, Vite                                              |
| Backend            | Node.js, Express, TypeScript                                         |
| Validation         | Zod                                                                  |
| Persistence        | Supabase/Postgres, with in-memory repositories for local development |
| Testing            | Vitest, Supertest, React Testing Library                             |
| Receipt extraction | Fine-tuned Qwen2-VL model with a local inference integration         |

## Architecture

```text
frontend/
  src/screens/       User-facing bill, assignment, and summary flows
  src/context/       Authentication and bill state
  src/api/           Backend client

backend/
  src/domain/        Split calculation rules
  src/routes/        HTTP boundary
  src/services/      Bill and account workflows
  src/repository/    In-memory and Supabase persistence
  src/schemas/       Request validation

model/
  receipt_inference.py   Local receipt inference entry point
```

The frontend calls the backend through a typed API client. Backend routes validate input and delegate to services; services apply the bill rules through repository interfaces. This keeps the calculation and persistence logic independent of the React screens and allows local development without a configured database.

## Engineering and quality

The repository includes:

- backend integration tests for authentication, bill access, item assignment, and penny-exact split behavior
- a frontend API integration test that calls the Express backend over HTTP through the production API client
- frontend screen tests for authentication, bill creation/join/history, assignment, and summary/payment actions
- CI checks for ESLint, Prettier, coverage thresholds, and frontend/backend production builds

Coverage is enforced as a regression floor, not a claim that every code path is tested. The current thresholds are:

| Layer    | Statements | Branches | Functions | Lines |
| -------- | ---------: | -------: | --------: | ----: |
| Backend  |        78% |      68% |       76% |   80% |
| Frontend |        67% |      62% |       66% |   70% |

## Run locally

Prerequisites: Node.js 20 or newer and npm.

Start the backend in one terminal:

```bash
cd backend
npm ci
npm run dev
```

Start the frontend in another:

```bash
cd frontend
npm ci
npm run dev
```

The local frontend runs at `http://localhost:5173`; the backend defaults to `http://localhost:3001`. The backend uses in-memory storage by default. Supabase persistence and receipt-model dependencies are optional and require local environment setup; see [backend/README.md](backend/README.md).

## Run the quality checks

Run these commands from each of `backend/` and `frontend/`:

```bash
npm run lint
npm run format
npm run test:coverage
npm run build
```

## Current focus

- expanding integration and screen-level coverage across the bill lifecycle
- improving receipt extraction and its fallback experience
- continuing to harden configuration for production deployment
