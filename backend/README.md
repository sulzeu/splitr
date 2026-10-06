# SplitReceipt Backend

This is the server-side application for SplitReceipt. It handles auth, bill state, persistence, and the local receipt-processing flow.

## Local development

```bash
npm install
npm run dev
```

Common validation commands:

```bash
npm run lint
npm run format
npm run test:coverage
npm run build
```

The backend defaults to in-memory storage unless Supabase env vars are configured.

## Required configuration

Create a local `.env` file in this folder when you need persistence or OAuth-backed flows. Keep server-only secrets in `.env` or in CI secret storage; do not expose them in public-facing documentation or frontend code.

Typical values include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT`
- `CORS_ORIGIN`
- `SPLITRECEIPT_PYTHON`

Use `SUPABASE_SERVICE_ROLE_KEY` only on the backend. It must never be exposed to the browser or client app.

## Typical app flows

The server supports the normal bill lifecycle:

- account registration and login
- authenticated bill creation and lookup
- join-code access for shared bills
- people and item management
- item assignment and split calculation
- paid/unpaid history tracking
- optional local receipt extraction
