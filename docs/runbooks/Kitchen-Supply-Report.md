# Kitchen stock issue report

Open **المطابخ → سجل صرف المطابخ → تقرير صرف المطابخ والرسوم**, or **التقارير والتحليلات → سجل صرف المطابخ**. This is the full accepted history, independent of the latest 100 operational documents. Pending/rejected local documents remain in the operational history and do not enter report totals.

Choose the business-date period (up to 366 inclusive days), current location/all locations, receiving kitchen, category, material or search. Search accepts material names/codes, references and full KI document numbers. Selecting a source location includes its outgoing supplies; selecting a destination kitchen includes supplies received there. When a kitchen supplies another kitchen, ranking/filtering uses the receiving kitchen. Selecting all locations still counts a document once.

- **قيمة المخزون المحوّل للمطابخ** uses posted outgoing transfer value. Incoming FIFO allocations are excluded to avoid double counting. This is stock transferred, not consumption.
- **استهلاك سابق من مستندات الصرف** uses historical direct kitchen issues only. Selected sales consumption belongs in **استهلاك المطابخ** and is excluded here.
- Document count is distinct by document across all filtered material lines. Material count is distinct by material; quantities with different units are never summed.
- Daily lines separate transfers and legacy consumption. The top-ten kitchen ranking uses both types of issue documents and is labelled accordingly. Clicking a day/kitchen or its keyboard alternative filters the complete report.

Details show material/code/category, business date/type, document number/reference, source, receiving kitchen, base quantity/unit, allocated unit cost and posted value. Unit cost is the line's actual value divided by quantity, including blended FIFO allocations, not today's inventory average. Sort and page on the server; totals and charts remain complete. CSV exports all filtered lines up to 10,000, preserving document identifiers and verifying an unchanged checkpoint. PDF/printing includes the currently displayed detail page and charts.

Reports retain the existing tenant/generation-scoped offline cache. Loaded reports/pages are available offline with their timestamp; new periods/pages require a connection. No stock writes, schema migration or outbox format change occurs.
