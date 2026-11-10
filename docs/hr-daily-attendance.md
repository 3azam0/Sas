# Daily attendance policy

The daily entry/exit screen requests `policy: daytime-12h-v1`.

- Entry is the earliest device-local punch between 07:00:00 and 16:05:00, inclusive.
- Exit is the latest punch between 14:00:00 and 05:00:00 the following day, inclusive, at least **11 hours after that entry**. The intended shift is 12 hours; 11 hours is the minimum accepted checkout interval.
- Later punches never replace the entry. Repeat scans less than 60 minutes after entry remain in the raw count but are not classified as checkout. All other scans before 11 hours also cannot close the day.
- A 00:00–05:00 punch belongs to the preceding attendance day. A punch after 05:00 and before 07:00 is retained on its calendar day for review.
- No entry means no inferred exit. Invalid-window and too-early checkout candidates appear in the raw log and the daily review count. Missing entry and missing exit remain explicit.
- Device/badge pairs remain separate. The entire filtered range is aggregated before daily pagination.

The summary is a read-only projection over existing and future raw events. No timestamps, device direction codes, verification modes, employee mappings, or ingestion receipts are rewritten. Cached clients retain the legacy calendar-day response until they request the new policy. The separate shift-planning calculation continues to use assigned/detected shift definitions.

Example: code 108's 2026-11-04 01:23:58 scan closes the entry at 2026-11-03 13:18:38. The 2026-11-04 13:32:10 scan starts the next attendance day and has no exit until a qualifying later scan exists.

Validation: `tests/hr.test.ts` covers existing history, raw-event preservation, legacy compatibility, window boundaries, 11-hour boundaries, repeats spanning clock hours, missing entries, device isolation, pagination and authorization. Shared HR tables allow vertical scroll chaining and expose named keyboard-focusable regions; wide tables retain horizontal scrolling.
