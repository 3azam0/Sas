# Optional opening-stock reference — 1 November 2026

Opening balances may omit their reference or leave it blank. The form labels the field optional; server validation defaults an omitted reference to an empty string and retains the 200-character limit. Quantity, cost, tenant, generation and stock-posting rules are unchanged.

The live frontend (build `d3bf04d0f44c0f24`) already allowed blank references, while Supabase `fodo-api` version 25 required two characters. The mismatch reproduced the generic `INVALID_OPENING` rejection.

## Validation and deployment

- All 10 opening-stock tests passed, including empty, whitespace, omitted and single-character references, stock valuation and idempotent retries.
- The current live backend was downloaded and patched at exactly one opening-reference schema expression. Other live features and authentication were preserved; no database migration was applied.
- Supabase `fodo-api` version **26** is active, with its existing `verify_jwt=false` setting and in-function authentication preserved. Retrieved deployment source matches the prepared patch exactly.
- Before deployment, four validation probes returned `INVALID_OPENING`. After deployment, each passed reference validation and reached the deliberately nonexistent location (`INVALID_REFERENCE`). Probes stopped before stock/document writes; the verification session was signed out.
- No Cloudflare frontend replacement was needed. Its existing build already accepts empty references.
- Local rollback artifact: ignored `.cache/optional-opening-reference/backend-before.js`.

The full local TypeScript check initially reported missing `pdf-lib`, `recharts` and `fflate` dependencies. These were unrelated to the opening-reference change; dependency restoration is separate from the verified live backend patch.
