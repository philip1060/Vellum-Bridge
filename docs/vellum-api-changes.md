# Vellum API changes needed for the SillyTavern extension

**For:** the Vellum repo (`philip1060/vellum`)
**Why:** the Vellum SillyTavern extension (`philip1060/Vellum-Bridge`) runs in the browser inside SillyTavern. It calls `https://vellum.thecentralempire.com/api/v1/*` directly with a read-only API key (`Authorization: Bearer vlm_...`). Two things it needs are missing from the public API today:

1. **Portraits:** the browser is not allowed to read Vellum's pictures.
2. **Favorites:** the API has no way to list the key owner's favorites ("loved" items).

The extension is already written against the contract below. Once Vellum ships these changes, both features turn on without any change to the extension.

---

## 1. Let browsers read pictures (CORS on `/img/*`)

### Problem

The API returns `image_url` and `image_original_url` (e.g. `https://vellum.thecentralempire.com/img/c/23/main/<hash>/large.webp`). The extension must `fetch()` those bytes to build the character PNG and to upload the persona avatar. `/img/*` responses carry **no** `Access-Control-Allow-Origin` header, so Chrome and Firefox block the read:

```
Access to fetch at 'https://vellum.thecentralempire.com/img/...' from origin 'http://127.0.0.1:8000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The `/api/v1/*` responses already have the right headers (`API_CORS_HEADERS` in `src/lib/api-keys/auth.server.ts`). Only the pictures are missing them.

You can confirm it today:

```sh
curl -sI -H "Origin: http://127.0.0.1:8000" \
  "https://vellum.thecentralempire.com/img/c/23/main/24d026eee61cc64e2a4302d40f9ec992eb8db5092f253875de72fbd6c8f911a5/thumb.webp" \
  | grep -i access-control      # prints nothing today
```

### Change

Add `access-control-allow-origin: *` to **every** response from the picture routes. That covers 200s, 304s and redirects, because a cross-origin `fetch()` that follows a redirect needs the header on the redirect too:

- `src/lib/images/serve.server.ts`: all `new Response(...)` calls (the original-file branch, the built-variant branch, the fallback-to-original branch, and the 304s).
- `src/lib/images/redirect.server.ts`: the 302 with `location:`.
- `src/lib/image-http.server.ts`: the shared helper's 200 and 304 responses, if any picture route uses it.

A small shared constant keeps it tidy, e.g. `export const IMAGE_CORS = { "access-control-allow-origin": "*" }`, spread into each `headers` object.

This is safe because:
- The pictures are already public (anyone can open them in a tab); CORS only lets scripts read what's already public.
- No cookies are involved (`*` can't be combined with credentials, and the extension doesn't send any).
- Only approved, visible content gets an `image_url` in the API in the first place.

### Cloudflare

Pictures are served `public, max-age=31536000, immutable` behind Cloudflare. Copies already in the edge cache were stored **without** the new header and may keep being served that way. After deploying, **purge the Cloudflare cache for `/img/*`** (or purge everything once). Otherwise old portraits keep failing until they expire.

### Done when

```sh
curl -sI -H "Origin: http://127.0.0.1:8000" "https://vellum.thecentralempire.com/img/c/23/main/<hash>/thumb.webp" | grep -i access-control
# access-control-allow-origin: *
```

The same holds for an `image_original_url` (the untouched original, e.g. `.../original.png`) and for any redirect a picture URL goes through.

---

## 2. List the key owner's favorites

### Problem

Vellum already stores favorites. Card hearts go in the `favorites` table (`migrations/0002_cards.sql`) and lorebook hearts in `lorebook_favorites` (`migrations/0005_lorebook_favorites.sql`). The site shows them on `/favorites` (`listMyFavorites` in `src/lib/cards/queries.ts` and the lorebook equivalent). But `/api/v1` has no way to ask "what has the owner of this key favorited?", so the extension can't offer "add everything I've loved".

`sort=loved` exists on the list endpoints, but it means *most loved by everyone*, not *my* favorites.

### New endpoints

All of them use the read scope, key auth, rate limit and JSON/CORS helpers that `/api/v1/cards` already uses. They live in `route()` in `src/lib/public-api.server.ts`. Today `route()` rejects any extra path segment (`if (rest.length > 0) return 404`), so the `me` branch needs to handle `me/favorites/<kind>` before that check.

```
GET /api/v1/me/favorites/cards       ?q= &tags= &limit= &offset=
GET /api/v1/me/favorites/lorebooks   ?q= &tags= &limit= &offset=
GET /api/v1/me/favorites/personas    (only if personas get favorites; see below)
```

**Response:** exactly the same shape as the matching list endpoint (`GET /api/v1/cards`, `GET /api/v1/lorebooks`), so the extension reuses its list code:

```json
{
  "data": [ { "id": 85042, "name": "...", "creator": "...", "url": "https://vellum.thecentralempire.com/c/85042",
              "image_url": "https://vellum.thecentralempire.com/img/...", "tags": [], "favorites": 12, "...": "..." } ],
  "paging": { "limit": 24, "offset": 0, "has_more": true, "next_offset": 24 }
}
```

Each item goes through the same `cardSummary` / `loreSummary` the list endpoints use.

**Rules:**
- **Whose favorites:** the key owner's, i.e. `caller.userId` from `authenticateApiRequest`. Never from a query parameter.
- **Order:** newest favorite first (`order by <favorites table>.created_at desc`), so "what I just loved" is at the top. `sort=` may be accepted and ignored.
- **Visibility:** the same filter as the other API lists, meaning approved only and within the key owner's Ratings settings (`loadViewer(caller.userId)` + `visibleTo`, or the same SQL the list uses). Anything the owner favorited that is now hidden, removed or no longer approved is simply left out. That way, opening an item from this list never 404s.
- **Paging:** same `limit` (default 24, max 40) and `offset` as the other lists, via the existing `listParams` / `page` helpers (fetch `limit + 1` rows to compute `has_more`).
- **`q` and `tags`:** optional. Nice to have, same meaning as on the lists. If they're too much work for the first version, ignore them; the extension still works.
- **Downloads:** listing favorites must not bump `downloads` (only `GET /cards/:id` and `GET /lorebooks/:id` do).

**Implementation hints (not requirements):**
- Cards: `listCards` already takes `likedBy`, which filters to cards a given user favorited. Calling it inside `withSettledViewer`, the way the `/api/v1/cards` branch does, with `likedBy: caller.userId`, may be all that's needed, plus an order-by-favorited-time option. Alternatively, write a query like `listMyFavorites` that takes the user id and limit/offset as arguments instead of reading them from the session.
- Lorebooks: there is no `likedBy` on `listLorebooks` yet. Mirror the card approach using `lorebook_favorites`.
- Unknown `<kind>`: `404 not_found` with `"No such endpoint."`, like other unknown paths. The extension treats a 404 here as "this Vellum doesn't offer favorites for that kind" and says so.

### Personas (optional)

Personas have no favorites today (no table, no heart button). If you want "loved personas" too, add a `persona_favorites (user_id, persona_id, created_at, primary key (user_id, persona_id))` table, a heart on `/p/:id` and the `/favorites` page, plus `GET /api/v1/me/favorites/personas` with the same rules. Skipping it is fine. The extension will show "no favorites for personas" until it exists.

### Also update the docs

- The header comment at the top of `src/lib/public-api.server.ts` (the endpoint list).
- `docs/api.md`.
- The "How to use a key" text on the Settings page (`src/components/api-keys-section.tsx`), so `/api/v1/me/favorites/cards` is listed next to `/api/v1/lorebooks`, `/api/v1/personas` and `/api/v1/me`.

### Done when

```sh
KEY=vlm_...   # a read key for an account that has hearted some cards and lorebooks
curl -s -H "Authorization: Bearer $KEY" "https://vellum.thecentralempire.com/api/v1/me/favorites/cards?limit=5"
# -> { "data": [ ...that account's favorited cards, newest heart first... ], "paging": { ... } }
curl -s -H "Authorization: Bearer $KEY" "https://vellum.thecentralempire.com/api/v1/me/favorites/lorebooks?limit=5"
# -> same for lorebooks
curl -s -H "Authorization: Bearer $KEY" "https://vellum.thecentralempire.com/api/v1/me/favorites/cards?limit=1&offset=1"
# -> paging works; has_more / next_offset correct
```

Also check that a key from a *different* account returns that account's favorites, not the first one's, and that an NSFW favorite is left out when that account's Ratings have NSFW off.

---

## What the extension does with this (for context)

- **Paste a link → Add:** `GET /api/v1/cards/:id`, then fetch `image_original_url` (falling back to `image_url`), then write the card into the PNG and import it. With change 1 the real portrait is used; without it the extension falls back to a placeholder and shows a notice.
- **Personas:** `GET /api/v1/personas/:id`, then fetch the avatar image, then upload it as the SillyTavern persona avatar. Needs change 1 as well.
- **Browse → "My favorites":** `GET /api/v1/me/favorites/{cards|lorebooks|personas}` with paging, each with an Add button and an "Add all" button. Needs change 2.

No other API changes are needed. Existing fields and endpoints stay exactly as they are.
