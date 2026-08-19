/* STRIPE SWITCHBOARD — the only file ops edits to go Stripe-native.
 * Today (all empty): the store runs fully on the practice's live secure store —
 * every Buy button opens the real product page; the bag hands off per item.
 * Stripe-native: set publishableKey + per-SKU Payment Links (fastest, no backend)
 * or price IDs (Checkout via the API in backend/API_CONTRACT.md).
 * See STRIPE_STORE_RUNBOOK.md. Keys are publishable-class only — never secret keys here. */
window.TSA_STRIPE = {
  publishableKey: "",
  paymentLinks: {},        /* { "bella-roma-hqra": "https://buy.stripe.com/…", … } */
  subscriptionLinks: {},   /* { "bella-roma-hqra": "https://buy.stripe.com/…recurring…", … } */
  membershipLinks: {},     /* { "ciao-bella": "…", "bellissima": "…" } */
  checkoutEndpoint: ""     /* e.g. https://api.tulsasurgicalarts.com/v1/checkout/session */
};
