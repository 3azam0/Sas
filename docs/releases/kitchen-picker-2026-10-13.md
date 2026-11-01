# Receiving kitchen picker — 13 October 2026

The stock issue editor uses the shared searchable dropdown for **المطبخ المستلم**. It opens on entry, searches kitchen names, and supports arrows/Enter. Enter after selection moves to the date; required-field errors target the visible picker. Active destinations remain scoped to the organization and exclude the source stock location. Dropdown text retains room for its chevron on desktop and mobile. The selected kitchen still routes the existing transfer document; stock posting and APIs are unchanged.

Hosted build: `a1d89d2eeb57b627`. Cloudflare version: `d48c660f-939b-4848-b5eb-d40dd1049409`; deployment `7d835320-a39b-4719-a1a9-0265c83312a9`, verified at 100% traffic on `2026-10-13T07:29:00.307453Z`. Existing bindings and observability were retained. Supabase API remains version 12; no migration or backend deployment was required.

Verification: TypeScript check passed; 10 relevant dropdown, keyboard, issue-preview and kitchen offline tests passed across four files; hosted build passed. Browser verification selected both current kitchens through search and mouse/keyboard, confirmed Enter moved to the date, checked the hosted asset hash and found no console errors. The 390px mobile dialog had equal scroll/client widths and 38px dropdown end padding. No stock document was saved.

The requested single item/quantity entry area with a newest-first receipt list is under discussion and is not part of this picker release.
