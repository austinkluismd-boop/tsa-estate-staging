# STRIPE STORE RUNBOOK — the PAVA pattern for Tulsa Surgical Arts (2026-08-19)

## What's already true (no keys required)
The rebuilt `store.html` is fully functional today: every product, membership tier, package,
concern page, gift card and policy link opens its **real** page on the practice's live secure
store (52 preserved URLs — gate W25 enforces the superset forever). The bag, membership tiers,
and concierge-refills program all work through real channels right now. Stripe is a
**switchboard**, not a dependency: `assets/js/store-config.js` is the single file that flips
the store Stripe-native. No card data ever touches the site itself (Stripe-hosted surfaces
only → SAQ-A class PCI posture).

## Phase 1 — account + products (owner, ~30 min, test mode first)
1. dashboard.stripe.com → create the **Tulsa Surgical Arts / Bella Roma** account (or a
   connected account under the same org pattern as PAVA's). Business type: company; statement
   descriptor: `BELLAROMA TSA`.
2. Products: import from `backend/seed/stripe_catalog.json` — 15 retail SKUs (one Product each,
   one-time Price; add prices from the Magento admin export, the authoritative source).
3. Recurring Prices:
   - **The Bella Club — Ciao Bella** (monthly) and **Bellissima** (monthly): create as
     subscription Products mirroring the live Magento tiers.
   - **Refill subscriptions**: for each subscription-eligible SKU, add a recurring Price
     (30/60/90-day interval options).
4. Enable Link + Apple Pay/Google Pay (Checkout settings) and Stripe Tax (OK nexus).

## Phase 2 — go live with Payment Links (no backend needed)
1. For each Product/Price: create a **Payment Link** (test mode → verify → live mode).
2. Paste into `assets/js/store-config.js`:
   ```js
   paymentLinks:      { "bella-roma-hqra": "https://buy.stripe.com/…", … },
   subscriptionLinks: { "bella-roma-hqra": "https://buy.stripe.com/…", … },
   membershipLinks:   { "ciao-bella": "https://buy.stripe.com/…", "bellissima": "https://buy.stripe.com/…" }
   ```
3. Rebuild-verify-ship per the standing loop (`preflight_realsite.py` → render check → push).
   The bag and every Join/Buy button switch to Stripe automatically; Magento links remain the
   documented fallback until cutover.

## Phase 3 — full Checkout + webhooks (the API phase, with the AWS kit)
- `POST /v1/checkout/session` (multi-item bag → Stripe Checkout Session) and
  `POST /v1/webhooks/stripe` are specified in `backend/API_CONTRACT.md`; the DDL for orders,
  subscriptions, membership states and the append-only `stripe_events` ledger is in
  `backend/schema_store.sql`.
- Webhook events to consume: `checkout.session.completed`, `invoice.paid`,
  `customer.subscription.updated/deleted`, `charge.refunded` (idempotent on event id).
- Secret keys live in the AWS secrets store / `SECRETS_LOCAL` — **never** in the site,
  never in chat. `store-config.js` carries publishable-class values only.

## Cutover doctrine
Run Magento and Stripe in parallel until Stripe has processed cleanly for two weeks; then
point the 15 SKU Buy buttons at Stripe exclusively and keep Magento for legacy order history.
Fulfillment source of truth = Stripe Dashboard + the orders tables.

## The two 5-minute unlocks only you can do
1. **Magento admin → Products → Export CSV** — hands me the complete catalog (names, SKUs,
   **prices**, stock) to extend the grid from the 15 flagship SKUs to the full inventory and
   to prefill every Stripe Product. (The storefront's Cloudflare WAF blocks crawling — the
   admin export is the clean, total answer.)
2. Stripe account creation (Phase 1.1) — everything downstream is prepared.
