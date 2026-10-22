# Collapsible workspace sidebar — 22 October 2026

## Behavior

- Desktop: top-bar toggle hides/reopens the sidebar, expands the content and remembers the device preference after refresh.
- Phone: top-bar toggle and bottom menu share a right-side native modal panel. Selection, close, Escape and backdrop dismiss it. Focus returns to its opener; background scrolling is restored.
- Resizing separates mobile open state from the desktop preference. Closing the sidebar preserves the mounted workspace, current page, filters and POS cart.
- The in-app start guide explains the controls. No business commands, schema or client transactions changed.

## Verification

TypeScript and 9 targeted navigation/workflow/guide tests passed. Production/offline and hosted builds passed. Isolated real-component browser checks passed at desktop 1280 px, tablet 820 px, phone 390 px and short phone 320 px: full-width desktop content (1021 to 1265 px), refresh persistence, Enter toggle, POS draft retention, mobile focus, Escape, backdrop, selection and no document horizontal overflow. The synthetic unpaid cart was removed without posting a sale.

Hosted at [FooDo](https://fodo.am-agent2026.workers.dev/?release=bf792914b39e3536): build **bf792914b39e3536**, Cloudflare version **84** (**050e56bf-1e5a-43ef-a01e-fb10c692d7b4**), deployment **d897358a-b081-4197-89ce-845171e0f231** at **100%**. Source **b3d6c60**, branch **feat/collapsible-sidebar**. API **16** is unchanged. Live desktop open/close and phone drawer/focus checks passed; hosted health matches the build. Desktop and phone screenshots are saved in outputs/Sidebar-20261022. No client business transactions were posted. Git publication remains pending the existing Windows credential-manager restriction.
