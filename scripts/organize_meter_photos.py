#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
organize_meter_photos.py  (VillageMan)
--------------------------------------
Rename + file common-area METER PHOTOS from an inbox into the
meter-photos/<category>/<year>/ tree used by the VillageMan app.

WHY: the VillageMan web app (file://) cannot write to disk, so this script
does the rename + move the app cannot. Run it whenever you drop new photos.

INBOX LAYOUT (you choose: "folder per meter"):
    meter-photos/inbox/<meterNo>/<any-photo>.jpg
  e.g. meter-photos/inbox/9788192/IMG_1234.jpg

WHAT IT DOES per photo:
  1. meter number  = the inbox subfolder name
  2. shot date     = EXIF DateTimeOriginal, else file-modified time (fallback)
  3. period        = the month BEFORE the shot month (early-month billing rule)
  4. category      = utility_type of the matching meter in meters.json
                     (electricity / water / ...). Falls back to "other".
  5. renames to    <meterNo>_<YYYY-MM>.<ext>  (period, lowercase ext)
  6. moves to      meter-photos/<category>/<year>/
     (year/month taken from the PERIOD, matching the app's filing)

meters.json: export it from the app (Settings -> Export meters.json) and save
it next to this script (or in the app root). Maps meter number -> category via
installation / meter_no / ca_no. Optional: if absent, everything -> "other".

Safe: never overwrites. On name clash it appends _2, _3, ...
"""
import os, sys, json, shutil, datetime

# ---- make stdout utf-8 (Thai-safe) on Windows cp1252 consoles ----
try:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(HERE)                 # VillageMan/
PHOTOS = os.path.join(APP_ROOT, "meter-photos")
INBOX = os.path.join(PHOTOS, "inbox")

IMG_EXT = {".jpg", ".jpeg", ".png", ".heic", ".webp", ".gif", ".bmp"}


def log(msg):
    print(msg)


def find_meters_json():
    for cand in [os.path.join(HERE, "meters.json"),
                 os.path.join(APP_ROOT, "meters.json"),
                 os.path.join(PHOTOS, "meters.json")]:
        if os.path.isfile(cand):
            return cand
    return None


def load_meter_map():
    """meter-number (installation/meter_no/ca_no) -> category (utility_type bucket)."""
    path = find_meters_json()
    if not path:
        log("NOTE: meters.json not found - all photos will go to category 'other'.")
        return {}
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        log("WARN: cannot read meters.json (%s) - using 'other'." % e)
        return {}
    meters = data.get("meters", data) if isinstance(data, dict) else data
    m = {}
    for mt in (meters or []):
        cat = cat_of(mt.get("utility_type", ""))
        for key in (mt.get("installation"), mt.get("meter_no"), mt.get("ca_no")):
            if key:
                m[str(key).strip()] = cat
    return m


def cat_of(utility_type):
    t = (utility_type or "").strip().lower()
    if t.startswith("e") or "elec" in t or "ไฟ" in t:
        return "electricity"
    if t.startswith("w") or "water" in t or "น" in t:
        return "water"
    return "other"


def exif_date(path):
    """Return datetime from EXIF DateTimeOriginal, else None."""
    try:
        from PIL import Image, ExifTags
    except Exception:
        return None
    try:
        img = Image.open(path)
        ex = img.getexif()
        if not ex:
            return None
        tagmap = {v: k for k, v in ExifTags.TAGS.items()}
        # 36867 = DateTimeOriginal ; 306 = DateTime
        for tagid in (36867, 306):
            val = ex.get(tagid)
            if val:
                try:
                    return datetime.datetime.strptime(str(val)[:19], "%Y:%m:%d %H:%M:%S")
                except Exception:
                    pass
        # some phones nest DateTimeOriginal in the Exif IFD
        try:
            ifd = ex.get_ifd(0x8769)
            v = ifd.get(36867)
            if v:
                return datetime.datetime.strptime(str(v)[:19], "%Y:%m:%d %H:%M:%S")
        except Exception:
            pass
    except Exception:
        return None
    return None


def shot_date(path):
    d = exif_date(path)
    src = "EXIF"
    if d is None:
        d = datetime.datetime.fromtimestamp(os.path.getmtime(path))
        src = "file-mtime"
    return d, src


def period_of(dt):
    """Month BEFORE the shot month (early-month billing rule). Returns (year, month)."""
    y, m = dt.year, dt.month
    m -= 1
    if m == 0:
        m = 12
        y -= 1
    return y, m


def unique_path(folder, base, ext):
    cand = os.path.join(folder, base + ext)
    if not os.path.exists(cand):
        return cand
    i = 2
    while True:
        cand = os.path.join(folder, "%s_%d%s" % (base, i, ext))
        if not os.path.exists(cand):
            return cand
        i += 1


def main():
    if not os.path.isdir(INBOX):
        log("Inbox not found: %s" % INBOX)
        log("Create meter-photos/inbox/<meterNo>/ and drop photos there.")
        return
    meter_cat = load_meter_map()
    moved = 0
    skipped = 0
    for meter_no in sorted(os.listdir(INBOX)):
        sub = os.path.join(INBOX, meter_no)
        if not os.path.isdir(sub):
            continue
        cat = meter_cat.get(str(meter_no).strip(), "other")
        for fn in sorted(os.listdir(sub)):
            src = os.path.join(sub, fn)
            if not os.path.isfile(src):
                continue
            ext = os.path.splitext(fn)[1].lower()
            if ext not in IMG_EXT:
                continue
            dt, dsrc = shot_date(src)
            py_, pm_ = period_of(dt)
            dest_dir = os.path.join(PHOTOS, cat, str(py_))
            os.makedirs(dest_dir, exist_ok=True)
            # Filename uses the PERIOD (YYYY-MM) so it matches the app's Suggest path and the
            # public report's guessed path:  <meterNo>_<YYYY-MM>.jpg  (<=1 photo per period).
            period_str = "%04d-%02d" % (py_, pm_)
            base = "%s_%s" % (meter_no, period_str)
            dest = unique_path(dest_dir, base, ".jpg" if ext in (".jpeg", ".jpg") else ext)
            try:
                shutil.move(src, dest)
                rel = os.path.relpath(dest, APP_ROOT).replace("\\", "/")
                log("OK  [%s] %s  ->  %s  (shot date via %s, period %d-%02d)"
                    % (cat, fn, rel, dsrc, py_, pm_))
                moved += 1
            except Exception as e:
                log("ERR %s -> %s : %s" % (src, dest, e))
                skipped += 1
    log("")
    log("Done. moved=%d skipped=%d" % (moved, skipped))
    log("Tip: open the VillageMan Bills form, use the suggested path, or copy the")
    log("     printed path above into the bill's Meter photo path field.")


if __name__ == "__main__":
    main()
