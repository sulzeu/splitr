# SplitReceipt

A bill-splitting app that lets a table split a receipt fairly — proportional to what each person actually ordered, not an even per-head split. Includes an AI-powered receipt scanner (fine-tuned vision-language model) to auto-extract line items from a photo.

---

## Status: In development

| Area | Status |
|---|---|
| Core bill-splitting logic | Done |
| Backend REST API | Done |
| Auth (email/password + OAuth) | Done |
| Frontend (React) | Done |
| Supabase persistence | Done |
| AI receipt scanning (Qwen2-VL) | Fine-tuned, integrated |
| Shared types/schemas (backend - frontend) | In progress — not yet unified |
| Deployment | Not yet deployed |
| Tests | Not yet added |

---

## Features

- **Cent-exact splitting** — item cost, GST, tip, and service fee are distributed using the largest-remainder method, so shares always sum exactly to the total (no missing/extra cent).
- **GST handling** — supports inclusive, exclusive, or no-GST modes (Australian menu conventions by default).
- **Join codes** — a 6-character human-typable code lets anyone view or help edit a shared bill without an account.
- **Accounts & history** — email/password or Google/Apple OAuth login; past bills (active and paid) are saved per account.
- **AI receipt scanning** — photograph a receipt and have items, prices, and totals extracted automatically via a fine-tuned vision-language model, with manual entry as a fallback.

---

## Tech stack

**Frontend:** React, TypeScript, Vite
**Backend:** Express, TypeScript, Zod (validation)
**Database:** Supabase (Postgres), with an in-memory implementation for local development
**ML:** Qwen2-VL-2B fine-tuned via QLoRA (4-bit) using MLX on Apple Silicon

---

## Architecture

```
splitreceipt/
├── backend/
│   ├── domain/          # Core types & business logic (splitCalculator)
│   ├── repository/      # Data access (in-memory + Supabase implementations)
│   ├── services/        # Application logic (billService, accountService, receiptService)
│   ├── routes/          # Express routers
│   ├── schemas/         # Zod validation schemas
│   ├── middleware/      # Auth, error handling, async wrapper
│   └── utils/           # Join code generation, HTTP errors
├── frontend/
│   ├── context/         # BillContext, AuthContext
│   ├── screens/         # Home, People, Items, Assign, Summary, Auth
│   ├── components/      # Shared UI components
│   └── api/             # Backend client
└── model/
    ├── training_mlx.ipynb    # Fine-tuning pipeline (MLX / Apple Silicon)
    ├── training_cuda.ipynb   # Fine-tuning pipeline (CUDA)
    ├── receipt_inference.py  # Inference script called by the backend
    └── annotation.py         # Auto-labeling pipeline (Gemini-assisted)
```

The backend uses a **repository pattern** — swapping from in-memory storage to Supabase/Postgres is a one-line change in `server.ts`, with no changes needed in routes or business logic.

> **Note:** Backend (`domain/types.ts` / Zod schemas) and frontend (`src/types.ts`) currently define their own copies of shared types like `Bill`, `BillItem`, and `GstMode`. These are kept in sync by hand for now — a shared types package (or generating frontend types from the Zod schemas) is on the roadmap to prevent drift between the two.

---

## Machine learning results

Fine-tuned `Qwen2-VL-2B-Instruct` (4-bit QLoRA, 500 iterations, ~9.2M trainable params) on 792 receipt images from the CORD-v2 dataset, evaluated on a 100-image held-out test set:

| Metric | Zero-shot baseline | Fine-tuned | Change |
|---|---|---|---|
| Item precision | 0.443 | 0.643 | +45.1% |
| Item recall | 0.522 | 0.660 | +26.4% |
| Item F1 | 0.463 | 0.643 | +38.9% |
| Total accuracy | 71% | 80% | +9 pts |

---

## Roadmap

- [ ] Unify types/schemas between backend and frontend (currently defined separately in each — risk of drift, e.g. `Bill`/`BillItem` shapes)
- [ ] Add automated tests (unit tests for split calculator, integration tests for API)
- [ ] Deploy backend + frontend
- [ ] Improve receipt scanning accuracy further (larger training set, Qwen3-VL once memory constraints are resolved)
- [ ] Add currency support beyond AUD/GST
- [ ] Push notifications for join-code activity

---

## Getting started

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a `.env` file to use Postgres persistence; otherwise the backend falls back to in-memory storage automatically.