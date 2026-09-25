# SplitReceipt — Web

React + TypeScript + Vite frontend for the SplitReceipt backend. Same
receipt-print visual language as the React Native app, now talking to a
real server instead of holding local state — so a split started on one
device can be joined and edited from another.

## Run it

You need the [backend](../splitreceipt-backend) running first.

```bash
# in splitreceipt-backend/
npm install && npm run dev     # http://localhost:3001

# in splitreceipt-web/
npm install && npm run dev     # http://localhost:5173
```

If you're testing from a phone browser against a backend running on your
laptop, `localhost` won't resolve to your laptop from the phone. Create a
`.env` file:

```
VITE_API_BASE_URL=http://192.168.1.23:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

(replace with your laptop's LAN IP — `ipconfig getifaddr en0` on macOS,
`hostname -I` on Linux).

Google and Apple login use Supabase Auth. Enable both providers in Supabase and
add the frontend origin, such as `http://localhost:5173`, to the allowed
redirect URLs. The backend must also have Supabase configured to verify the
OAuth access token.

## What changed from the original local-state prototype

- `src/logic/splitCalculator.ts` is **gone from this project** — the
  backend is now the single source of truth for the split math. The
  frontend just calls `GET /bills/:id/split` and renders the result.
- `src/context/BillContext.tsx` now wraps the API client
  (`src/api/client.ts`) instead of local `useState` mutations. Every
  mutating call still returns the full updated bill, which the context
  uses to replace its local copy wholesale.
- The current bill's id is kept in `localStorage`, so refreshing the page
  restores your place instead of losing everything.
- Added a **join-by-code** flow on the home screen (`HomeScreen.tsx`) — the
  actual point of moving to a backend. `JoinCodeBanner` shows the current
  bill's code on every subsequent screen so the organizer can read it out
  or copy it for the table.

## Structure

```
src/
  api/client.ts          typed fetch wrapper — the only file that knows
                          the backend's URL shape
  context/BillContext.tsx global state: current bill + split + loading/error
  types.ts                same domain types as the backend (copied, not
                           yet shared as a package — see note below)
  screens/                Home -> People -> Items -> Assign -> Summary
  components/             Button, Perforation, JoinCodeBanner, ErrorBanner
  index.css               design tokens as CSS custom properties
```

## Known rough edges worth knowing about

- **`types.ts` is duplicated** across the backend and this project (and the
  React Native app). They're identical today because I copied them by
  hand. The honest long-term fix is a small shared npm package (or a
  monorepo with a workspace) that all three import from, so they can't
  silently drift apart. Not worth the tooling overhead yet with one
  frontend built against the backend — worth doing before the RN app also
  gets wired up, so you're not keeping three copies in sync by hand.
- **No real-time updates.** If two people have the same bill open at once,
  neither sees the other's changes until they trigger a request themselves
  (adding an item, toggling GST, etc. all refresh local state, but nothing
  pushes updates to an idle tab). Fine for "one organizer drives, others
  just view the join code and their own total," not fine yet for true
  simultaneous multi-editor use — that needs the WebSocket work flagged in
  the backend README.
- **Mobile browser Web Share support varies.** `navigator.share` works on
  iOS Safari and Android Chrome; desktop browsers fall back to copying the
  summary to the clipboard instead.
