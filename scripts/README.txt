VillageMan - Meter Photo Organizer
==================================

WHAT: renames + files common-area meter photos into
      meter-photos/<category>/<year>/  automatically.

WHY:  the VillageMan web app runs under file:// and cannot write files to
      disk. This script does the rename + move for you. Run it whenever you
      have new photos.

ONE-TIME SETUP
--------------
1. In the VillageMan app: Settings -> "Export meters.json".
2. Save the downloaded meters.json into THIS scripts/ folder
   (G:\My Drive\Develop\VillageMan\scripts\meters.json).
   Re-export whenever you add/change meters.
   (If meters.json is missing, every photo just goes to category "other".)

EACH TIME YOU HAVE NEW PHOTOS
-----------------------------
1. Make a folder per meter under the inbox, named by the meter number:
       meter-photos\inbox\9788192\
   Drop that meter's photos inside (any filename - e.g. straight from the phone).
   Use a separate subfolder per meter number.
2. Double-click  run_meter_photos.bat
3. The script will, for every photo:
   - read the shot date from EXIF (falls back to the file's modified time)
   - compute the billing PERIOD = the month BEFORE the shot month
     (you photograph at the start of a month for the previous month's usage);
     the PERIOD's YEAR decides which year folder the photo goes in
   - look up the meter's category (electricity/water) from meters.json
   - rename to   <meterNo>_<YYYY-MM-DD>.jpg
   - move it to  meter-photos\<category>\<year>\
4. It prints the final path of each photo. Copy that into the matching bill's
   "Meter photo path" field in the app (or use the app's Suggest path button).

NOTES
-----
- Never overwrites: a name clash becomes _2, _3, ...
- Supported: .jpg .jpeg .png .heic .webp .gif .bmp (output keeps the extension,
  jpeg normalised to .jpg).
- Needs Python 3 with Pillow (PIL) for EXIF. Without Pillow it still runs and
  uses the file's modified time as the date.
