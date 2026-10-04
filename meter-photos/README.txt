METER PHOTOS - FOLDER STRUCTURE
================================

Common-area METER PHOTOS, kept as reading evidence, filed as:

    meter-photos / <category> / <year> / <meterNo>_<YYYY-MM-DD>.jpg

This is SEPARATE from receipts/:
    receipts/      = payment slips / receipts (proof you PAID)
    meter-photos/  = photos of the meter dial (proof of the READING)

Categories:
    electricity/   common-area electricity meter photos
    water/         common-area water meter photos
    other/         anything else
    inbox/         DROP-OFF ONLY (not filed yet - see below)

Year  = 4 digits (e.g. 2026)
Filename = <meterNo>_<shot-date>.jpg   e.g. 9788192_2026-10-03.jpg

NOTE: the YEAR folder comes from the billing PERIOD (the month BEFORE the shot
month), so a photo taken early January counts as the previous December's period
and is filed under the previous year. The date IN the filename is the actual
shot date. Example: a photo taken 03/10/2026 (period Sep 2026) is filed as
.../electricity/2026/9788192_2026-10-03.jpg. Only ~12 files per meter per year,
so there is no month subfolder.

HOW TO FILE PHOTOS - two ways
-----------------------------
A) AUTOMATIC (recommended) - the organizer script:
   1. Put each meter's photos in its own inbox subfolder named by meter number:
          meter-photos/inbox/9788192/   (drop photos inside, any filename)
   2. Double-click  scripts/run_meter_photos.bat
   3. The script reads each photo's EXIF shot date (falls back to the file's
      modified time), computes the period (month before the shot month), finds
      the category from meters.json, renames to <meterNo>_<YYYY-MM-DD>.jpg, and
      moves it into meter-photos/<category>/<year>/.
   One-time: in the app, Settings -> Export meters.json, save it in scripts/.
   See scripts/README.txt for full details.

B) MANUAL - from the app's Bills form:
   The Bills form has a "Meter photo path" field with a "Suggest path" button
   and an "Add photo" (เลือกรูป) picker that builds the path for you. Copy it,
   then drop the photo into Google Drive at that path yourself. (The web app
   runs under file:// and cannot write files to disk, which is why the script
   in (A) exists.)

The app stores only the PATH, never the image - keeping it lightweight and the
photos shareable via Google Drive view-only permissions. Residents open the
"สรุปส่วนกลาง" page and click the photo link to verify each period's reading.
