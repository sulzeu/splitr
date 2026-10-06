# SplitReceipt — Web

React + TypeScript + Vite frontend for the SplitReceipt backend. Same
receipt-print visual language as the React Native app, now talking to a
real server instead of holding local state — so a split started on one
device can be joined and edited from another.

## Run it

You need the [backend](../splitreceipt-backend) running first.

```bash
# in splitr/backend/
npm install && npm run dev     # http://localhost:3001

# in splitr/frontend/
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