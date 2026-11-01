# Print/export audit — 28 October 2026

| Existing output | PDF | Excel | CSV | Print |
| --- | --- | --- | --- | --- |
| Material receiving, including livestock/lot details | Yes | Exact original values | — | Browser / Windows helper |
| Kitchen supply document | Yes | Document prices separate from stock cost | — | Browser / Windows helper |
| Cash-sale receipt | Yes | Lines, cash received, change, acceptance state | — | Browser / Windows helper |
| All report kinds, including stock card, butchery and reconciliation | Whole filtered range | Whole filtered range | Retained | Browser / Windows helper |
| Preparation plan requirements and progress | Yes | Yes | Retained | Via export preview |
| Purchasing suggestions | Yes | Yes | Retained | Via export preview |
| Transfer follow-up | Yes | Yes | Retained | Via export preview |
| Remaining lots/expiry | Yes | Yes | Retained | Via export preview |

Special-purpose exports remain appropriate to their consumer: opening import template is CSV; plan and recovery backups are validated JSON. They are not document/report export substitutes. No file-format renaming, server-side export endpoint or backend migration is introduced.

Shared components own download/print behavior; original serializers own exact document values. All existing `PrintPreview` and data CSV export call sites were inspected. Exported workbooks contain no user-generated formulas; identifiers/leading zeroes, null/zero and precision limits are verified. PDF raster pages preserve Arabic shaping and the current selected paper size. Existing direct-print pairing, printer queues, unknown response handling and explicit reprints remain unchanged.

See [printing guide](./runbooks/Printing.md) for limits and operation. The [verified live release](./releases/print-exports-2026-10-29.md) is build `413ca955b6fc9feb`, Worker101, API22 unchanged. Forty-two focused checks and five distinct browser scenarios pass, with independent PDF/workbook inspection.
