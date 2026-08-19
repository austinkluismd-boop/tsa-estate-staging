# SOCIAL INTEGRATION RUNBOOK — the no-password doctrine (2026-08-19)

## The three layers, and what each actually requires

| Layer | What it does | Credentials required |
|---|---|---|
| **1 · Embeds (LIVE NOW)** | TikTok/Instagram posts render inside the site; YouTube plays click-to-load | **NONE.** Public embeds use the platforms' public embed scripts. Already wired (`assets/js/social.js`) and hydrating on the staging URL. |
| **2 · Sync (feeds)** | `backend/social_sync.py` pulls latest posts into `social_posts` → server-rendered feeds, no third-party scripts | **API tokens only** — never account passwords (§1–3 below) |
| **3 · Publishing/analytics** | Posting, scheduling, per-post metrics | Platform OAuth apps or a scheduler (e.g., Postiz/Meta Business Suite) holding **OAuth grants**, never raw passwords |

## Why I will not take your passwords (even with permission)
1. **Unnecessary** — layer 1 needs nothing; layers 2–3 run on tokens the platforms are designed to issue.
2. **Chat is not a vault** — anything pasted into a conversation persists in that conversation. Your standing law is already correct: credentials live in `SECRETS_LOCAL/` on your Mac, get rotated after any exposure, and OAuth apps hold the working tokens.
3. **Account risk** — password-login automation trips Meta/TikTok security systems and violates their ToS; a locked practice account during launch week is a real cost. Tokens are the sanctioned, revocable instrument.
4. **The sanctioned alternative for anything interactive**: Claude in Chrome drives **your own logged-in browser** on your machine — you keep the passwords, I operate the session with you watching. Use this for grabbing embed codes, verifying Business Suite settings, or connecting OAuth apps.

## §1 TikTok — nothing to do
Public oEmbed already powers verification and metadata (`social_sync.py` uses it with zero auth). For layer 3 later: TikTok for Developers → Display/Content Posting API (OAuth).

## §2 Instagram + Facebook (one Meta app covers both) — ~15 min, owner-executable
1. Ensure the IG accounts (@tulsasurgicalarts, @bellaromamedspa, @oklahomasurgicalarts) are **Professional** accounts linked to their Facebook Pages (Meta Business Suite → Settings → Linked accounts).
2. developers.facebook.com → Create App (type: Business) → add **Instagram Graph API** product.
3. Graph API Explorer → select the app + Page → generate a token with `instagram_basic`, `pages_read_engagement` → exchange for a **long-lived token** (60-day; the sync worker refresh is a one-liner).
4. Get the IG user id: `GET /me/accounts` → page id → `GET /{page-id}?fields=instagram_business_account`.
5. On your Mac: append to `SECRETS_LOCAL/social.env`:
   ```
   IG_GRAPH_TOKEN=EAAB...      IG_USER_ID=1784...      FB_PAGE_TOKEN=EAAB...
   ```
   Never commit this file; rotation law applies.
6. Test: `set -a; source SECRETS_LOCAL/social.env; set +a; python3 backend/social_sync.py --dry-run`

## §3 YouTube — ~5 min
console.cloud.google.com (the practice GCP project from GOOGLE_LAYER) → enable **YouTube Data API v3** → Credentials → API key (restrict to that API) → `YT_API_KEY=...` into `SECRETS_LOCAL/social.env`. Public-data reads only; no OAuth needed.

## §4 Threads — link-out only (no useful public read API); the handle rows already carry it.

## Where things plug in
- Every embed slot: `SOCIAL_EMBED_MAP.md` (add a post = paste a blockquote; zero code).
- Sync output: `social_sync.py --json social_feed.json` → future build step renders feeds server-side and sets `TSA_SOCIAL.autoload=false` (third-party scripts drop to zero).
- Production home for tokens at AWS lift: the D_DAY kit's secrets store; same env-var names.
