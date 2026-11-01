# Compact receiving document details — 13 October 2026

The receiving editor now uses smaller headings, required/optional indicators, labels and keyboard hints above its receipt list. Supplier/date/reference fields have tighter gaps and padding. The **إضافة مادة** heading and its keyboard explanation are also compact. Desktop document controls use 38px minimum height; mobile controls retain 44px height and 16px text. Entry, validation, unit conversions and stock posting behavior are unchanged.

Hosted build d82107a0b560fd9c; Cloudflare version 256d27b0-9546-4e7f-9169-37fae1493efa, number 54; deployment aecf54dd-adb8-4aa6-b5c1-c5159010e3ec, verified at 100% traffic, created 2026-10-13T11:22:56.835676Z. No backend or schema changes; Supabase API remains version 13.

The hosted build passed. Live desktop measurements show document details reduced from 141.6px to 98.55px (about 30% less height) and entry heading from 47.6px to 34.55px. Both section titles are 13px. At 390px, document inputs retain 44px height and 16px text; material and quantity inputs remain aligned. No page/dialog horizontal overflow was observed. Verification opened and cancelled an empty receipt; no client data was submitted.

Developer Guide 2.44 and the form runbook record the change. Proof screenshots: outputs/Receiving-Compact-20261013/desktop.png and mobile.png (outside repository). GitHub publication remains pending the existing credential-helper issue.
