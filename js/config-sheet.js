/* config-sheet.js - Phase 2 connection settings for VillageMan.
   Fill these in AFTER you deploy the Apps Script web app (see PHASE2_SETUP.md).
   While endpoint is empty, the app stays on localStorage (Phase 1) - safe default.

   SECURITY NOTE: this file holds the WRITE token, so it must live ONLY in the
   private VillageMan app folder - NEVER copy it into the public VillageManPublic repo. */
window.CM_SHEET_CFG = {
  endpoint:  'https://script.google.com/macros/s/AKfycbyvisOSzAf_9VZJFhdKgqo0rKuazq0T33XhDb0x3HJSEoB2uE8z07irgxsUB_DeRMYN/exec',   // the /exec URL from Deploy > Web app
  writeToken:'vm_w_lc1ZEeSzjcc-8DmcJ8kWHk4sL616CKBr',   // must equal WRITE_TOKEN in Code.gs
  readToken: 'vm_r_9ucRrM3zSdoCyN3X95BXOvlFByKm9Bvu'    // must equal READ_TOKEN in Code.gs
};
