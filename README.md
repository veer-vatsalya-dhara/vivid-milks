# Vivid Milks

Daily milk subscription and delivery app for Android and iOS. Customers set their usual daily milk, change any day, and pause when away; delivery staff get an ordered list of drops each morning; admins run routes, products and wallets.

See [docs/mvp-plan.md](docs/mvp-plan.md) for the product plan.

## Repository layout

```
apps/mobile      React Native app (Expo, Expo Router, TypeScript)
apps/server      API server (Node.js, Fastify, Drizzle ORM, PostgreSQL)
packages/shared  Types, validation and date rules used by both
docs/            Product plan
```

## Getting started

Requirements: Node.js 24+ and npm. No database install is needed for development: the server uses an embedded PostgreSQL ([PGlite](https://pglite.dev)) stored in `apps/server/.data/`.

```bash
npm install

# Terminal 1: API server on http://localhost:4000 (creates sample data on first run)
npm run server

# Terminal 2: Expo dev server
npm run mobile
```

Open the app with Expo Go on a phone on the same Wi-Fi (scan the QR code), or press `a` for an Android emulator or `i` for the iOS simulator. The app finds the API server on the same machine as the Expo dev server; set `EXPO_PUBLIC_API_URL` to point it elsewhere.

### Signing in during development

Real login (WhatsApp OTP / Google) is not built yet. The app shows a **development sign-in** screen listing every user; pick one to act as them. Sample data includes an admin, a delivery person (Ravi), three customers, four milk products and a "Green Park" route. Admins can switch between Admin, Customer and Delivery modes from the Account screen.

To start over with fresh sample data, stop the server and delete `apps/server/.data/`.

## How orders work

- A customer's order for a day = their usual daily quantities, replaced by any change they made for that day, or zero while paused.
- Orders can be changed until the **cutoff** (admin setting, default 10:00 PM the evening before).
- At the cutoff the server **locks** the next day: each routed customer with an order gets a delivery if their wallet covers it, or is marked *skipped: low balance* otherwise.
- The wallet is charged when the delivery person marks a drop **Delivered**. Admins add money after receiving cash or UPI.

## Checks

```bash
npm run typecheck   # all workspaces
npm run lint        # mobile app
npm test            # shared + server tests (server tests run against in-memory PGlite)
```

These also run in GitHub Actions on every push and pull request.

## Database changes

Edit `apps/server/src/db/schema.ts`, then generate a migration:

```bash
npm run db:generate -w @vivid-milks/server
```

Migrations in `apps/server/drizzle/` are applied automatically when the server starts.

## Test deployment (Vercel)

One Vercel project serves both the **web version of the app** (`/`) and the **API** (`/api/*`). `scripts/vercel-build.mjs` builds it with Vercel's [Build Output API](https://vercel.com/docs/build-output-api): it migrates the database, exports the Expo app for web, and bundles the server into a single function. On Vercel, orders are locked when requests arrive after the cutoff, since there is no always-running timer.

Project environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Postgres connection string (added automatically by the Neon integration) |
| `DEV_AUTH` | `true` (development sign-in; anyone with the link can act as any user) |
| `SEED_IF_EMPTY` | `true` to load sample data into an empty database |

Deploy from this folder with `npx vercel deploy --prod`.

## Production notes

Set `DATABASE_URL` to a PostgreSQL database and `NODE_ENV=production`. With `NODE_ENV=production`, development sign-in and sample data are off unless `DEV_AUTH` / `SEED_IF_EMPTY` are set, so API routes stay disabled until real login is added. See `apps/server/.env.example`.
