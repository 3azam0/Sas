# Collapsible workspace sidebar — 22 October 2026

## Behavior

- Desktop: top-bar toggle hides/reopens the sidebar, expands the content and remembers the device preference after refresh.
- Phone: top-bar toggle and bottom menu share a right-side native modal panel. Selection, close, Escape and backdrop dismiss it. Focus returns to its opener; background scrolling is restored.
- Resizing separates mobile open state from the desktop preference. Closing the sidebar preserves the mounted workspace, current page, filters and POS cart.
- The in-app start guide explains the controls. No business commands, schema or client transactions changed.

## Verification

TypeScript and 9 targeted navigation/workflow/guide tests passed. Production build passed. Isolated real-component browser checks passed at desktop 1280 px, phone 390 px and short phone 320 px: full-width desktop content (1021 to 1265 px), refresh persistence, Enter toggle, POS draft retention, mobile focus, Escape, backdrop, selection and no document horizontal overflow. The synthetic unpaid cart was removed without posting a sale.

Hosted publication and live verification pending.
