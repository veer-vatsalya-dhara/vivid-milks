# Vivid Milks: MVP Plan

A daily milk subscription and delivery app, in the style of Milkbasket. Customers set a standing daily order, change it for any day, and pause it when away. Delivery staff get a simple ordered list of drops for the morning. Admins run the operation.

## Decisions so far

| Topic | Decision |
|---|---|
| Platforms | Android and iOS from one React Native (Expo) codebase |
| Backend | Custom server: Node.js + TypeScript + PostgreSQL |
| Payments | In-app prepaid wallet; **only admins credit it** (after cash/UPI received). No payment gateway in MVP |
| Products | Milk variants only (e.g. Cow 500 ml, Buffalo 1 L), managed by admin |
| Order cutoff | Admin setting. Placeholder default: 10:00 PM the night before |
| Low balance | No delivery if the wallet can't cover the day's order |
| Login | **Google sign-in** (web app now; phone apps with their store builds) until WhatsApp OTP is ready (Meta Cloud API setup in progress). Anyone can sign up as a customer; admins add delivery staff and admins by Google email. Customers add a mobile number during onboarding so delivery staff can call them |
| Delivery time | By 7:00 AM |
| Region | India: INR, `Asia/Kolkata` time zone |

## Roles

| Role | Can do |
|---|---|
| **Customer** | Manage own subscriptions, daily quantities, pauses, wallet view |
| **Delivery staff** | See assigned route for today, mark drops delivered / not delivered |
| **Admin** | Everything a customer and delivery staff can do, plus admin tools. Admins switch between *Customer*, *Delivery* and *Admin* modes in the app |

A user has exactly one role. New sign-ups are customers; admins promote users to delivery staff or admin by email. The first admin is set from a server setting (`ADMIN_EMAILS`).

## How a day works

1. **Before cutoff:** the customer's order for tomorrow is computed live. For each subscribed product, the quantity is:
   - the one-day change for that date, if the customer set one, otherwise
   - `0` if the subscription is paused on that date, otherwise
   - the subscription's default daily quantity.
2. **At cutoff:** a scheduled job locks tomorrow. For each customer with quantity > 0 it creates one **delivery**, recording each item with its price at that moment:
   - If the wallet's **available balance** (balance minus any not-yet-delivered orders) covers the order, the delivery is assigned to the customer's route and that route's delivery person.
   - If not, the delivery is recorded as **Skipped: low balance** and nobody is sent. The whole day is skipped, not part of it.

   After cutoff, customers can no longer change that day.
3. **Delivery morning (by 7:00 AM):** the delivery person opens the app, sees a load summary (total of each product to carry) and the ordered list of drops, and marks each one **Delivered** or **Not delivered** (with a reason: door locked, customer refused, other).
4. **Billing:** when a drop is marked *Delivered*, the wallet is debited for that delivery. Missed drops are not charged.

**Low balance:** before cutoff, customers whose balance won't cover tomorrow see a prominent warning ("Add ₹X before 10:00 PM or tomorrow's milk won't be delivered"). Admins see the same list so they can follow up and top up wallets. Once a wallet is topped up, deliveries resume from the next day that hasn't been locked yet.

## Features

### Customer
- **Sign in** with Google; first time: confirm name, add mobile number and delivery address.
- **Home:** tomorrow's order card with `−` / `+` per product, its cost, and notes like "changes allowed until 10:00 PM" and "delivered by 7:00 AM". Wallet balance and low-balance warning at the top.
- **Calendar:** next 30 days; tap a day to change quantities or skip it. Past and locked days are read-only and show what happened (delivered, not delivered, skipped for low balance).
- **Subscriptions:** add a product with a default daily quantity, change the default, remove it.
- **Pause / resume:** pause everything from date A to date B (vacation mode), or until resumed.
- **Wallet:** balance and list of credits (top-ups) and debits (deliveries).

### Delivery staff
- **Today:** load summary + ordered list of drops (name, address, landmark, items, call button).
- **Mark** each drop Delivered / Not delivered, with an undo for mistakes during the same day.
- **Progress:** "18 of 42 done".

### Admin
- **Dashboard:** tomorrow's totals per product (for procurement), today's delivery progress per route, customers whose balance won't cover tomorrow.
- **Customers:** search; view and edit a customer's subscriptions, address, route; **add wallet credit** (amount + note, e.g. "Cash ₹500").
- **Staff & roles:** promote a user to delivery staff or admin by email.
- **Routes:** create routes (e.g. "Green Park, Block A"), assign a delivery person, set customer order within a route.
- **Products:** add/edit name, unit, price, active/inactive. Price changes apply to deliveries locked after the change.
- **Settings:** order cutoff time.

## Data model (first pass)

All money is stored as integer paise. Dates for orders are calendar dates in IST.

```
users             id, google_sub (unique), email (unique), name, phone, role [customer|delivery|admin], created_at
addresses         id, user_id (unique, one per customer in MVP), line1, line2, area, landmark,
                  route_id, route_position
routes            id, name, delivery_user_id
products          id, name, unit_label, price_paise, active
subscriptions     id, customer_id, product_id, default_qty, status [active|cancelled], created_at
                  unique (customer_id, product_id) where active
pauses            id, customer_id, start_date, end_date (null = until resumed)
day_overrides     customer_id, product_id, date, qty            primary key (customer_id, product_id, date)
deliveries        id, date, customer_id, route_id, delivery_user_id, route_position,
                  status [pending|delivered|not_delivered|skipped_low_balance], reason, marked_at
                  unique (customer_id, date)
delivery_items    delivery_id, product_id, qty, unit_price_paise
wallet_txns       id, customer_id, amount_paise (+credit / −debit), type [topup|delivery|adjustment],
                  delivery_id, note, created_by, created_at
settings          key, value      (e.g. order_cutoff_time = "22:00")
```

Wallet balance = sum of `wallet_txns.amount_paise` for the customer. Available balance = balance − cost of the customer's `pending` deliveries.

## Tech stack

**Repository:** one repo, npm workspaces:
```
apps/mobile      Expo app (moved from the repo root)
apps/server      API server
packages/shared  Shared TypeScript types and validation schemas (zod)
```

**Mobile:** Expo Router with a route group per mode (`(customer)`, `(delivery)`, `(admin)`), Google sign-in, TanStack Query for API calls and caching, `expo-secure-store` for the session token. Google sign-in needs a development build rather than Expo Go.

**Server:**
- Node.js + TypeScript, **Fastify** HTTP API, **zod** validation
- **PostgreSQL** with **Drizzle ORM** and migrations
- Auth: the app sends the Google ID token; the server verifies it with Google, creates or finds the user, and returns a JWT access token + refresh token. Needs a Google Cloud project with OAuth client IDs for Android, iOS and web
- Scheduled cutoff job inside the server (runs every minute, locks the next day once past cutoff; safe to re-run)
- Local development: Postgres via Docker Compose
- Hosting (later): a managed Node host + managed Postgres (e.g. Render, Railway or Fly.io)

**Quality:** ESLint + TypeScript checks, server unit tests for the order/pause/override rules and wallet maths, GitHub Actions running lint, type check and tests on every push.

## Milestones

| # | Milestone | Outcome |
|---|---|---|
| 0 | **Foundation** | Monorepo layout, server skeleton, Postgres + migrations, CI |
| 1 | **Auth & profiles** | Roles, customer onboarding (name, phone, address), admin mode switcher. Real login (WhatsApp OTP / Google) added later in place of the development user picker |
| 2 | **Subscriptions** | Products, subscribe, change default qty, per-day changes, pause/resume, calendar, cutoff setting |
| 3 | **Deliveries** | Cutoff job, routes, delivery staff app (load summary, mark drops) |
| 4 | **Wallet & admin** | Wallet ledger, admin top-ups, debits on delivery, low-balance skipping and warnings, dashboard, customer/staff/product management |
| 5 | **Launch prep** | App icon & branding, push notification reminders before cutoff, EAS builds, server deployment |

## Not in the MVP

Payment gateway and self top-up · phone OTP and other login methods · multiple addresses per customer · alternate-day or weekday-only schedules · non-milk products and one-time add-ons · maps and route optimisation · offline mode for delivery staff · PDF invoices · referrals and coupons.

## Open questions

1. **Service area and sign-up approval:** to be decided. Until then sign-ups are open, and a customer only gets deliveries once an admin assigns them to a route.
2. **Phone number check:** the mobile number entered at onboarding is not verified in the MVP.
