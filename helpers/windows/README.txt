FooDo Print Helper 1.0.0 - Windows 10/11 (.NET Framework 4.8)

1. Extract the ZIP into a folder. Run Start-FooDo-Print.cmd.
2. Install your printer's official Windows driver if it is not already available.
3. Choose the A4 and/or 80 mm printer in the helper. Save printer settings.
   For thermal printing, confirm ESC/POS raster support and usable dot width
   (576 is the common starting value; use your model's manual). Enable cutting
   only if the printer supports the ESC/POS cut command.
4. In FooDo, open a document's print preview and expand Printer setup.
   Enter the pairing code displayed by this helper and connect.
5. Allow FooDo's localhost/local-device connection if your browser asks.
   This is the initial connection permission, not a print dialog.
6. Choose the paper and saved printer in FooDo, then Print directly.

Keep the helper running; minimizing hides it to the Windows tray.
Use the tray menu or its window to exit. It does not add startup tasks,
change the default printer, install drivers, register protocols or add firewall rules.
Android is not supported by this release.

The helper listens only at http://127.0.0.1:17856, accepts only the FooDo
website and the documented local development origin, and requires a paired
browser/organization token. Revoke pairings in the helper to disconnect all browsers.
Settings and job receipts are stored under your Windows local application data
in FooDo/PrintHelper. Image data is held in memory and discarded after submission.

Submitted means handed to the Windows printer queue, not proof paper printed.
After an interrupted/unknown result, inspect the printer and check the job
status in FooDo before explicitly requesting another copy. Jobs are never
automatically replayed after restart. Virtual PDF/XPS/Fax printers are excluded
because they may open save dialogs. A4 uses the Windows driver; thermal jobs
use raw ESC/POS raster. Test Arabic, totals, long documents, margins and cutting
on your exact printer before normal operations.

This is an unsigned, locally compiled application. SHA-256 hashes accompany
the download manifest; source and build instructions are in helpers/windows.
Do not bypass a security warning. Contact the system administrator if Windows
blocks the application. Close it and delete its folder to remove the program;
its local settings remain unless you remove them separately.
