# Code Review Recommendations

Review date: 2026-05-30

## Scope

Reviewed the current `cuteqrcodes` checkout across the Nuxt app, server APIs, shared utilities, database SQL snapshots, and Playwright tests. This is a recommendations document, not an implementation patch.

## Validation Snapshot

- `bun run typecheck` passed.
- `bun run test:e2e` passed: 48 tests.
- `bun run lint` failed with 1546 reported style issues, concentrated in `app/pages/print-labels.vue`.

## Recommended Changes

### 1. Restore Full-Repo Lint As A Required Signal

Priority: High

`app/pages/print-labels.vue` does not match the repo's lint style: double quotes, semicolons, trailing commas, arrow-paren style, and related stylistic errors start immediately at the imports. This makes `bun run lint` unusable as a regression check even though typecheck and e2e currently pass.

Evidence:

- `app/pages/print-labels.vue:1`
- `app/pages/print-labels.vue:10`
- `app/pages/print-labels.vue:32`

Recommended action:

- Run an auto-fix pass for `app/pages/print-labels.vue`, then manually review the diff.
- Add full lint back to the normal pre-publish or CI path after the file is cleaned up.

Suggested validation:

- `bunx eslint app/pages/print-labels.vue`
- `bun run lint`

### 2. Do Not Create A New Dynamic Link When An Existing Link Update Misses

Priority: High

`/api/qr/dynamic-links` accepts `existingLinkId`, but `createOrUpdateDynamicQrLink` falls back to link creation when that ID is not found for the user. A stale or invalid update request can therefore be treated as a new feature purchase instead of a missing-link error.

Evidence:

- `server/api/qr/dynamic-links.post.ts:17`
- `server/api/qr/dynamic-links.post.ts:19`
- `server/utils/dynamic-qr.ts:133`
- `server/utils/dynamic-qr.ts:142`

Recommended action:

- If `input.existingLinkId` is present and `getEditableDynamicQrLink` returns null, throw a 404 before computing cost or creating anything.
- Add a regression test that sends an invalid `existingLinkId` and asserts no credits are charged and no link is created.

Suggested validation:

- Add a server-side test around `createOrUpdateDynamicQrLink`.
- Add or extend e2e coverage for the saved QR edit URL flow.

### 3. Move Schema Creation And Destructive DDL Out Of Request Paths

Priority: High

The server creates and alters production tables from normal request handlers via `ensureSavedQrTables`, `ensureDynamicQrTables`, and `ensureCreditTables`. `ensureSavedQrTables` also drops constraints, drops a column, and drops `qr_folders` at runtime. This adds request latency, creates race risk during cold starts, and makes schema changes harder to audit or roll back.

Evidence:

- `server/utils/saved-qr.ts:22`
- `server/utils/saved-qr.ts:40`
- `server/utils/saved-qr.ts:46`
- `server/utils/saved-qr.ts:59`
- `server/utils/saved-qr.ts:62`
- `server/utils/dynamic-qr.ts:32`
- `server/utils/credits.ts:52`

Recommended action:

- Move these DDL blocks into explicit migrations.
- Keep request handlers limited to normal reads and writes.
- If lazy ensure helpers remain temporarily, make failed readiness promises reset so one transient DDL failure does not poison the worker until restart.

Suggested validation:

- Migration dry run against a fresh database.
- Migration run against a copy of production.
- Smoke tests for saved QR, dynamic QR, credits, and PDF purchase flows after migrations.

### 4. Add Server-Enforced Admin Authorization Before Adding More Admin Features

Priority: High

Admin mode is currently a client-side hardcoded email check. That is acceptable for the current client-only QR settings export, but it is not safe as a general admin mechanism because any future server-side admin feature must not trust client visibility.

Evidence:

- `app/utils/admin.ts:1`
- `app/utils/admin.ts:7`
- `app/pages/index.vue:617`

Recommended action:

- Move admin identity to database state or an environment-backed server allowlist.
- Add a server utility such as `requireAdminSession(event)`.
- Expose only non-sensitive client capability flags to the UI.
- Require server-side admin checks for every admin API route.

Suggested validation:

- Tests for admin, non-admin, logged-out, and case-normalized email behavior.
- Negative API tests proving non-admin users cannot call admin routes directly.

### 5. Validate And Limit Saved QR Payloads And Preview SVGs

Priority: High

The server accepts saved QR payloads after checking only `version` and `url`. Preview SVG, dimensions, label logo data URLs, dynamic-link details, and nested settings are mostly trusted from the client. This can bloat the database and makes malformed saved settings harder to reason about.

Evidence:

- `server/utils/saved-qr.ts:101`
- `server/utils/saved-qr.ts:104`
- `server/api/qr/saved.post.ts:17`
- `server/api/qr/saved.post.ts:24`
- `server/api/credits/pdf-purchases.post.ts:31`
- `server/api/credits/pdf-purchases.post.ts:43`

Recommended action:

- Define a strict server schema for `SavedQrPayload`.
- Enforce maximum lengths for URL, label text, additional text, SVG text, and data URLs.
- Validate dimensions are finite positive numbers within expected ranges.
- Validate dynamic-link payloads by ID from the database rather than trusting nested client fields.

Suggested validation:

- Unit tests for accepted and rejected payloads.
- API tests for oversize SVGs, invalid data URLs, invalid dimensions, and malformed nested dynamic link data.

### 6. Make Purchased PDF Persistence Resilient Across Database And R2

Priority: Medium-High

`savePurchasedPdf` uploads to R2 before the database write that deducts credits and records the purchase. The code tries to delete the object on SQL failure or empty rows, but the operation is still not atomic across R2 and Postgres. A crash, timeout, or failed cleanup can leave orphaned R2 objects; a post-write failure can leave records whose response path did not complete cleanly.

Evidence:

- `server/utils/credits.ts:301`
- `server/utils/credits.ts:364`
- `server/utils/credits.ts:372`
- `server/utils/credits.ts:660`
- `server/utils/credits.ts:672`

Recommended action:

- Use an explicit purchase state: `pending`, `stored`, `complete`, `failed`.
- Reserve credits and create a pending purchase record first, write R2 second, then finalize.
- Add an idempotency key per purchase attempt.
- Add a cleanup/reconciliation job for orphaned R2 objects or stale pending rows.

Suggested validation:

- Tests that simulate R2 put failure, SQL failure after R2 put, and retry with the same idempotency key.

### 7. Add Request Body Limits Before Reading Large Base64 Payloads

Priority: Medium-High

The PDF purchase endpoint calls `readBody` before size validation. The decoded PDF is capped at 10 MB, but the raw base64 body can already be large enough to pressure memory before `decodePdfBase64` runs. Saved QR preview SVGs have similar lack of size limits.

Evidence:

- `server/api/credits/pdf-purchases.post.ts:25`
- `server/api/credits/pdf-purchases.post.ts:29`
- `server/api/credits/pdf-purchases.post.ts:94`
- `server/api/credits/pdf-purchases.post.ts:102`
- `server/api/qr/saved.post.ts:17`

Recommended action:

- Configure Nitro/body limits for API routes that accept uploads.
- Reject based on `content-length` before parsing when possible.
- Consider uploading generated PDFs directly to R2 via a constrained server endpoint or moving PDF generation server-side.

Suggested validation:

- API tests for payloads just under and over the limit.
- Manual test for large malformed base64 payloads.

### 8. Stop Mutating `process.env` From Request Runtime Bindings

Priority: Medium

`populateProcessEnvFromRuntime` copies Cloudflare request environment values into global `process.env`. That makes event-local bindings global for the worker lifetime and couples helpers like `useNeon` to mutable process state.

Evidence:

- `server/utils/runtime-env.ts:20`
- `server/utils/runtime-env.ts:30`
- `server/utils/runtime-env.ts:37`
- `server/utils/runtime-env.ts:39`
- `server/middleware/runtime-env.ts:4`

Recommended action:

- Prefer event-aware helpers, for example `useNeon(event)` and `getLemonSqueezyConfig(event)`.
- Leave `process.env` as a local-development fallback only.
- Remove the global mutation middleware once all runtime consumers are event-aware.

Suggested validation:

- Local dev auth, credits, webhook, and Cloudflare preview smoke tests.
- Unit tests for Cloudflare env precedence versus local `process.env`.

### 9. Reduce Credit Balance Read Write-Amplification

Priority: Medium

`getCreditBalance` performs an `insert ... on conflict do update` on every balance read, even when the row already exists and no value changes. This creates unnecessary writes and row locks for summary pages, checkout-return polling, and purchase flows.

Evidence:

- `server/utils/credits.ts:114`
- `server/utils/credits.ts:117`
- `server/utils/credits.ts:120`

Recommended action:

- Use `insert ... on conflict do nothing`, then `select balance`.
- Or create the balance row only at account creation / first credit transaction.

Suggested validation:

- Credits summary and checkout-return polling tests.
- Database query log check to confirm reads no longer write.

### 10. Add Scan Data Retention And Privacy Controls

Priority: Medium

Dynamic QR scan tracking stores IP address, user agent, referrer, and Cloudflare-derived location data. That can be useful, but it needs explicit retention and minimization decisions.

Evidence:

- `server/utils/dynamic-qr.ts:48`
- `server/utils/dynamic-qr.ts:51`
- `server/utils/dynamic-qr.ts:58`
- `server/utils/dynamic-qr.ts:158`
- `server/utils/dynamic-qr.ts:407`

Recommended action:

- Decide whether full IP addresses are needed after geo lookup.
- Consider hashing/truncating IPs or storing only country/region/city.
- Add a retention job or rollup table for old scan rows.
- Make the product copy and privacy policy match the stored fields.

Suggested validation:

- Tests for scan insert shape.
- Backfill/retention dry run on a database copy.

### 11. Break Up The Large UI And Service Modules

Priority: Medium

Several files carry too many responsibilities. `app/pages/index.vue` includes QR state, SVG geometry, color/icon/label controls, export, persistence, and template markup. `app/pages/print-labels.vue` includes label selection, credit checks, PDF generation, purchase submission, window handling, and template markup. `server/utils/credits.ts` combines schema, credits, Lemon Squeezy config, PDF purchase persistence, R2 access, and mapping.

Evidence:

- `app/pages/index.vue` is over 5000 lines.
- `app/pages/print-labels.vue` is over 1100 lines.
- `server/utils/credits.ts` is about 750 lines.

Recommended action:

- Extract QR builder state into composables.
- Extract label, color, icon, border, and dynamic-link panels into components.
- Move PDF rendering into `app/utils` or a dedicated renderer module.
- Split credit balance, checkout, PDF purchase, R2 storage, and transaction mapping into separate server services.

Suggested validation:

- Preserve current e2e coverage during extraction.
- Add a small unit-test layer for extracted pure functions.

### 12. Add Low-Level Tests For The Hand-Rolled QR Encoder

Priority: Medium

The QR encoder is custom and manually encodes version tables, Reed-Solomon blocks, masks, and format/version bits. Current e2e tests exercise rendered behavior, but they do not prove QR code conformance across supported versions and error-correction levels.

Evidence:

- `app/utils/qr.ts:42`
- `app/utils/qr.ts:89`
- `app/utils/qr.ts:94`
- `app/utils/qr.ts:237`
- `tests/e2e/center-icons.spec.ts:39`

Recommended action:

- Add unit tests with known-good matrices or decode round-trips using an independent QR decoder.
- Cover boundary byte lengths, unicode URLs, medium/high correction, min-version behavior, and center-icon high-error-correction paths.
- Consider replacing the encoder with a maintained QR library if requirements expand beyond the currently configured versions.

Suggested validation:

- Unit tests for QR versions 1 through 10 at medium and high error correction.
- Decode generated SVG/PNG samples with an independent scanner in CI if practical.

### 13. Harden Webhook Parsing And Observability

Priority: Medium

The Lemon Squeezy webhook verifies the signature before parsing JSON, which is good, but malformed signed JSON currently flows through raw `JSON.parse`. Operationally, ignored or incomplete events are returned to the caller but not logged or surfaced anywhere.

Evidence:

- `server/api/lemon-squeezy/webhook.post.ts:31`
- `server/api/lemon-squeezy/webhook.post.ts:42`
- `server/api/lemon-squeezy/webhook.post.ts:44`
- `server/api/lemon-squeezy/webhook.post.ts:63`

Recommended action:

- Catch JSON parse errors and return a 400 with a clear status message.
- Add structured logging for ignored event names, unpaid orders, store mismatches, incomplete metadata, duplicate orders, and processed orders.
- Consider an admin-only webhook event ledger if payment support work continues.

Suggested validation:

- Webhook tests for invalid signature, malformed JSON, ignored event, duplicate order, and paid order.

### 14. Be Explicit About Nuxt DevTools In Production Builds

Priority: Low

`nuxt.config.ts` enables devtools unconditionally. Nuxt generally treats devtools as development-time tooling, but the production intent is clearer if this is environment-gated or omitted unless needed.

Evidence:

- `nuxt.config.ts:9`
- `nuxt.config.ts:10`

Recommended action:

- Set devtools from an environment flag or disable it in committed config.

Suggested validation:

- `bun run build`
- Verify production bundle does not expose dev-only tooling.

### 15. Add Server-Side Integration Tests For Credits, Saved QR, And Dynamic QR

Priority: Medium

The Playwright suite is strong for UI flows, but many tests route or mock API responses. The highest-risk behavior is now in server SQL/R2/webhook logic, where e2e coverage does not fully exercise real persistence, constraints, or idempotency.

Evidence:

- `tests/e2e` has 48 passing UI tests.
- `server/utils/credits.ts:253`
- `server/utils/credits.ts:301`
- `server/utils/dynamic-qr.ts:120`
- `server/api/lemon-squeezy/webhook.post.ts:28`

Recommended action:

- Add server integration tests against a disposable Postgres/Neon branch or a mocked SQL adapter with assertion-friendly query behavior.
- Cover credit grants, duplicate webhook handling, dynamic-link creation/update costs, PDF purchase rollback paths, and saved QR payload validation.

Suggested validation:

- New `test:server` or `test:unit` command in `package.json`.
- CI runs typecheck, lint, unit/server tests, and focused e2e.

