# Stock issue shortcut — 12 October 2026

**صرف مخزون** now appears beside **استلام مواد** in the shared workspace heading. It opens the existing kitchen issue editor directly for the selected warehouse, without navigating away from the current screen. Cancelling returns keyboard focus to the shortcut. It uses the existing active-kitchen, source-location, catalog and session requirements; the disabled shortcut explains where to add a kitchen through its title.

The editor is reused by both the shortcut and the existing kitchen page. Stock consumption, valuation, offline capture, synchronization and history are unchanged. See [Kitchen issues](../runbooks/Kitchen-Issues.md).

- Hosted build: `95730ad863a7888a`, confirmed in the loaded browser asset.
- Cloudflare deployment: `e2089a6d3daa4e49863f5b6e03910571`; upload succeeded with HTTP 200 and existing Worker settings/bindings were preserved.
- Local Next production build, TypeScript and hosted bundling passed. The local offline manifest has 42 assets. No additional tests were introduced for this reversible UI shortcut.
- Hosted draft checks confirmed the three header actions share the same row, the new button opens the issue form for the main warehouse, its kitchen field receives focus, and Escape/Cancel returns focus without changing the overview or inventory screen.
- The shortcut and editor were checked at the default desktop viewport and 390×844. The phone has no document horizontal overflow. Screenshots are beside this repository in `outputs/Stock-Issue-Shortcut-20261012`. The viewport override was reset.
- No issue/setup record was saved. The overview still showed 338 materials, stock value 196,868.65 EGP and zero pending operations. No new console errors were observed.
- Local branch: `feat/stock-issue-shortcut`, stacked from `f7c66ca`. Remote source publication remains pending the previously observed Windows Git credential-helper restriction; hosted publication is verified independently.

No database, backend, authentication configuration or local launcher changes were needed.
