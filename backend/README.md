# SplitReceipt Backend

REST API for bill splitting, personal accounts, and persisted bill history.

## Run it

```bash
npm install
npm run dev
npm test
npm run typecheck
```

## Receipt extraction

Receipt scanning runs locally through the fine-tuned MLX Qwen2-VL adapter in
`../model/adapters2`. On Apple Silicon, install the model runtime once from
the workspace root:

```bash
python3 -m pip install -r model/requirements.txt
```

The backend invokes `model/receipt_inference.py` when the frontend posts an
image to `POST /api/bills/:billId/receipt`. Set `SPLITRECEIPT_PYTHON` if the
adapter dependencies are installed in a virtual environment.

For the Conda environment used during development:

```bash
export SPLITRECEIPT_PYTHON=/opt/homebrew/anaconda3/envs/splitr/bin/python
export SPLITRECEIPT_ADAPTER_PATH=/Users/you/Desktop/Projects/apps/splitreceipt/model/adapters2
```

## Supabase persistence

Create a Supabase project and run [supabase/schema.sql](supabase/schema.sql) in
the Supabase SQL editor. Copy [.env.example](.env.example) to `.env` and set:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

The service-role key is backend-only and must never be exposed to the
frontend. With these variables set, accounts, sessions, bills, and paid bill
history are stored in Supabase. Without them, the server uses in-memory
repositories for local tests.

## API

Registration and login return a bearer token. Send it as
`Authorization: Bearer <token>` on protected requests. Join-code lookup is
public for collaboration; direct bill access and mutations belong to the
owning account.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, displayName }` | Creates an account and returns a token |
| POST | `/api/auth/login` | `{ email, password }` | Returns a token |
| POST | `/api/auth/oauth` | `{ accessToken }` | Exchanges a verified Supabase Google/Apple token for a SplitReceipt token |
| GET | `/api/auth/me` | - | Current account |
| GET | `/api/auth/me/bills` | - | Returns `{ active, paid }` |
| POST | `/api/auth/logout` | - | Revokes the current session |
| POST | `/api/bills` | `{ title? }` | Creates an owned bill |
| GET | `/api/bills/:billId` | - | Owner only |
| GET | `/api/bills/by-code/:joinCode` | - | Public, case-insensitive lookup |
| GET | `/api/bills/by-code/:joinCode/split` | - | Public read-only split calculation |
| PATCH | `/api/bills/:billId` | Settings fields | Owner only |
| PATCH | `/api/bills/:billId/paid` | `{ paid: boolean }` | Moves bill between active and paid history |
| GET | `/api/bills/:billId/split` | - | Owner only |
| POST | `/api/bills/:billId/people` | `{ name }` | Owner only |
| PATCH | `/api/bills/:billId/people/:personId/settled` | `{ settled: boolean }` | Settles one person |
| POST | `/api/bills/:billId/items` | `{ name, price, quantity? }` | Owner only |
| POST | `/api/bills/:billId/receipt` | `{ imageBase64 }` | Runs the local fine-tuned Qwen2-VL adapter and appends extracted items |
| PATCH | `/api/bills/:billId/items/:itemId` | Item fields | Owner only |
| DELETE | `/api/bills/:billId/items/:itemId` | - | Owner only |
| POST | `/api/bills/:billId/items/:itemId/assignments` | `{ personId }` | Toggles an assignment |

The `BillRepository` and `AccountRepository` interfaces keep persistence
separate from business logic. `server.ts` selects the Supabase implementations
when configured and the in-memory implementations otherwise.

Before public deployment, restrict CORS, add rate limiting, and rotate any
service-role key that has been exposed.

## Google and Apple login setup

Enable Google and Apple under Supabase Dashboard -> Authentication -> Providers.
Add `http://localhost:5173` to the allowed redirect URLs, and add the deployed
frontend origin for production. Configure the frontend with
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Keep
`SUPABASE_SERVICE_ROLE_KEY` backend-only; the backend verifies OAuth tokens
before creating the application's own session.
# SplitReceipt Backend

REST API that owns the bill-splitting logic and state, so the web, iOS, and
Android clients stay in sync and none of them reimplement the split math.

## Run it

```bash
npm install
npm run dev        # http://localhost:3001, auto-reloads on change
```

```bash
npm test           # integration tests (supertest against the real Express app)
npm run typecheck
npm run build && npm start   # production build
```

## Architecture

```
src/
  domain/

## Supabase persistence

Create a Supabase project, run [supabase/schema.sql](supabase/schema.sql) in
the Supabase SQL editor, and configure the backend with the values in
[.env.example](.env.example). `SUPABASE_SERVICE_ROLE_KEY` is server-only and
must never be exposed to the frontend. When those variables are present,
accounts, sessions, bills, and paid bill history are stored in Supabase.
Without them, the server falls back to in-memory storage for local tests.
    types.ts               Bill / Person / BillItem / split result types
    splitCalculator.ts      the split math — copied verbatim from the
                             already-tested client-side version, unchanged.
                             Penny-exact via largest-remainder method; see
                             its doc comments for the GST/tip/fee rules.
  repository/
    billRepository.ts       the persistence INTERFACE — swap point for a
                             real database.
    inMemoryBillRepository.ts   current implementation: plain in-memory
                             Maps. Not persistent — restarting the server
                             loses all bills. Deliberate for now; see
                             "Adding a real database" below.
  services/
    billService.ts           all business logic — mutations go through
                              here, never directly through the repository
                              from a route.
  routes/bills.ts             HTTP layer: Zod validation, thin pass-through
                               to billService.
  repository/                persistence interfaces plus in-memory and
                             Supabase implementations
  middleware/                 error handling + async route wrapper
  utils/joinCode.ts            6-character human-typable codes (no 0/O/1/I/L)
  app.ts                       Express app factory (no listen() call — this
                                is what the tests import)
  server.ts                    actual process entry point, calls listen()
```

## Why an in-memory store, and how to move off it

Everything in `services/` and `routes/` talks to persistence only through the
`BillRepository` interface. The in-memory repository is used when Supabase is
not configured, which keeps local development and tests fast.

To add persistence:

1. Implement `BillRepository` against Postgres (Prisma is a natural fit —
   `Bill.items`/`Bill.people` map cleanly to relations, with a join table
   for item↔person assignments) or whatever you prefer.
2. Change one line in `server.ts`: swap `new InMemoryBillRepository()` for
   your new class.
3. Nothing in `services/`, `routes/`, or `domain/` needs to change.

## API

All bill-mutating endpoints return the **full updated bill** in the
response, so a client can just replace its local state wholesale — no
partial-patch merging logic needed on the client side. This also happens
to be the simplest model for polling-based multi-device sync.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/bills` | `{ title? }` | Creates a bill, returns it with a fresh `joinCode` |
| POST | `/api/auth/register` | `{ email, password, displayName }` | Creates an account and returns a bearer token |
| POST | `/api/auth/login` | `{ email, password }` | Returns a bearer token |
| GET | `/api/auth/me` | — | Current account |
| GET | `/api/auth/me/bills` | — | Returns `{ active, paid }` bill history |
| POST | `/api/auth/logout` | — | Revokes the current session |
| GET | `/api/bills/:billId` | — | |
| GET | `/api/bills/by-code/:joinCode` | — | case-insensitive |
| PATCH | `/api/bills/:billId` | `{ title?, gstMode?, gstRate?, tipAmount?, serviceFeeAmount? }` | any subset |
| GET | `/api/bills/:billId/split` | — | returns `SplitResult`, not a `Bill` |
| POST | `/api/bills/:billId/people` | `{ name }` | |
| PATCH | `/api/bills/:billId/people/:personId/settled` | `{ settled: boolean }` | "mark as paid" |
| POST | `/api/bills/:billId/items` | `{ name, price, quantity? }` | |
| PATCH | `/api/bills/:billId/items/:itemId` | `{ name?, price?, quantity? }` | any subset |
| POST | `/api/bills/:billId/items/:itemId/assignments` | `{ personId }` | **toggles** — calling it again for the same person un-assigns them |

Errors are `{ "error": string }` with an appropriate status code (400 for
## Operational follow-ups

- **No real-time push.** Clients poll `GET /bills/:id` (or `/split`). Adding
  WebSockets (or Server-Sent Events) for live multi-device updates is a
  clean, isolated fast-follow once the REST shape has proven itself against
  real clients — don't build it speculatively before that.
- **Authentication is implemented.** Restrict direct bill access to the
  owning account; join-code access remains public for collaboration.
- **No rate limiting / abuse protection.** Add before any public deployment.
- **CORS is wide open** (`cors()` with no options) for local development
  against the web/RN clients. Restrict `origin` before deploying anywhere
  public.

