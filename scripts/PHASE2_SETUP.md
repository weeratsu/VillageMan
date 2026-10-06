# VillageMan Phase 2 - Google Sheets backend (setup guide)

Goal: edit data in the VillageMan app and have it live - NO export/push.
The app reads & writes a private Google Sheet through a Google Apps Script web app.

DATA MODEL: one tab per collection (meters, utility_bills, households, ...),
header row = field names, one row per record. meta and counters are key-value
tabs. You can open the Sheet and read / sort / pivot the data directly.
IMPORTANT: edit through the APP, not by typing in the Sheet - the app owns the
data and overwrites each tab on every save (hand edits would be clobbered).

You do the Google side ONCE (steps 1-6). After that it just works.

--------------------------------------------------------------------
## 1. Create the Google Sheet
- Go to https://sheets.new  (or Drive > New > Google Sheets).
- Name it e.g. "VillageMan Data".
- You do NOT need to add tabs - the script creates them on first save.
- Note the Sheet ID from the URL:
    https://docs.google.com/spreadsheets/d/<THIS_IS_THE_ID>/edit

## 2. Add the Apps Script
- In the Sheet: Extensions > Apps Script.
- Delete whatever is there, paste the whole contents of Code.gs.
- At the top of Code.gs, fill in:
    SHEET_ID    = '<the id from step 1>'
    WRITE_TOKEN = '<a long random string you make up>'
    READ_TOKEN  = '<a different long random string>'
- Save (disk icon).

## 3. Deploy as a Web app
- Deploy > New deployment > gear icon > type: Web app.
- Execute as: Me ; Who has access: Anyone (still gated by your tokens).
- Deploy, authorize when asked (it is your own script).
- Copy the Web app URL ending in /exec - that is your endpoint.

## 4. Quick test
Open in a browser (replace both parts):
    <your /exec URL>?action=ping&token=[REDACTED_PARAM] READ_TOKEN>
Expect:  {"ok":true,"now":"..."}
Then test a real read:
    <your /exec URL>?action=all&token=[REDACTED_PARAM] READ_TOKEN>
Expect:  {"ok":true,"data":{...}}  (empty collections on a fresh Sheet)

## 5. Point the app at the backend
- Open  VillageMan/js/config-sheet.js  and fill in:
    endpoint:   '<your /exec URL>'
    writeToken: '<same as WRITE_TOKEN>'
    readToken:  '<same as READ_TOKEN>'
- Save. Hard-refresh the app (Ctrl+Shift+R). The app now uses the Sheet.

## 6. Move your existing data into the Sheet (one time)
BEFORE filling in config-sheet.js (while still on localStorage):
  - App > Settings > Export JSON. Save the file.
AFTER filling in config-sheet.js (now pointed at the Sheet):
  - App > Settings > Import JSON, load that file once.
  - The app writes every record up to the Sheet (tabs auto-created).
From then on, each edit saves straight to the Sheet, and you can open the
Sheet to read the tables yourself.

## Re-deploying after a Code.gs change
Deploy > Manage deployments > (pencil) > Version: New version > Deploy.
The /exec URL stays the same.

## Security notes
- config-sheet.js holds the WRITE token - keep it ONLY in the private VillageMan
  folder, NEVER in VillageManPublic (the public repo).
- The public resident page should use the READ token only.
- Anyone with the write token can change the data - treat it like a password.
