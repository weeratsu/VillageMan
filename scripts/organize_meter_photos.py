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


def _parse_existing(fn):
    """Parse an already-filed photo name -> (meterNo, period, shotDate or '', ext).
    Accepts <meterNo>_<YYYY-MM>.ext  or  <meterNo>_<YYYY-MM>_<YYYY-MM-DD>.ext
    (optionally with a _2/_3 dedup suffix before the ext)."""
    name, ext = os.path.splitext(fn)
    ext = ext.lower()
    if ext not in IMG_EXT:
        return None
    import re
    m = re.match(r"^(.+?)_(\d{4}-\d{2})(?:_(\d{4}-\d{2}-\d{2}))?(?:_\d+)?$", name)
    if not m:
        return None
    return m.group(1), m.group(2), (m.group(3) or ""), ext


def rename_existing():
    """Add the EXIF shot-date suffix to already-filed photos that lack it.
    Only renames when EXIF DateTimeOriginal is readable; files without it stay as-is."""
    renamed = 0
    if not os.path.isdir(PHOTOS):
        return 0
    for cat in sorted(os.listdir(PHOTOS)):
        catdir = os.path.join(PHOTOS, cat)
        if not os.path.isdir(catdir) or cat == "inbox":
            continue
        for year in sorted(os.listdir(catdir)):
            ydir = os.path.join(catdir, year)
            if not os.path.isdir(ydir):
                continue
            for fn in sorted(os.listdir(ydir)):
                full = os.path.join(ydir, fn)
                if not os.path.isfile(full):
                    continue
                parsed = _parse_existing(fn)
                if not parsed:
                    continue
                meter_no, period, shot, ext = parsed
                if shot:
                    continue  # already has a date
                d = exif_date(full)
                if not d:
                    continue  # no EXIF -> leave unchanged (user decision)
                base = "%s_%s_%s" % (meter_no, period, d.strftime("%Y-%m-%d"))
                dest = unique_path(ydir, base, ".jpg" if ext in (".jpeg", ".jpg") else ext)
                try:
                    os.rename(full, dest)
                    log("REN %s  ->  %s" % (fn, os.path.basename(dest)))
                    renamed += 1
                except Exception as e:
                    log("ERR rename %s : %s" % (fn, e))
    return renamed


def build_index():
    """Write meter-photos/index.json mapping '<cat>/<year>/<meterNo>_<period>' -> actual filename.
    Lets the app + public report resolve the real file (which may carry a _<date> suffix)
    without guessing. Latest shot date wins if duplicates exist for a period."""
    index = {}
    if not os.path.isdir(PHOTOS):
        return 0
    for cat in sorted(os.listdir(PHOTOS)):
        catdir = os.path.join(PHOTOS, cat)
        if not os.path.isdir(catdir) or cat == "inbox":
            continue
        for year in sorted(os.listdir(catdir)):
            ydir = os.path.join(catdir, year)
            if not os.path.isdir(ydir):
                continue
            for fn in sorted(os.listdir(ydir)):
                if not os.path.isfile(os.path.join(ydir, fn)):
                    continue
                parsed = _parse_existing(fn)
                if not parsed:
                    continue
                meter_no, period, shot, ext = parsed
                key = "%s/%s/%s_%s" % (cat, year, meter_no, period)
                prev = index.get(key)
                # prefer the entry whose shot date is latest (dated beats undated)
                if prev is None or (shot and shot > prev.get("shot", "")):
                    index[key] = {"file": "%s/%s/%s" % (cat, year, fn), "shot": shot}
    out = os.path.join(PHOTOS, "index.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    # Also write a <script>-loadable version (file:// blocks fetch of .json, so the app loads this).
    out_js = os.path.join(PHOTOS, "photo_index.js")
    with open(out_js, "w", encoding="utf-8") as f:
        f.write("window.VM_PHOTO_INDEX = " + json.dumps(index, ensure_ascii=False, indent=1) + ";\n")
    log("index written: %d entries (index.json + photo_index.js)" % len(index))
    return len(index)


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
            # Filename = <meterNo>_<period>[_<shotDate>].jpg
            #   period   = YYYY-MM (billing period, always present) -> keeps path resolvable
            #   shotDate = YYYY-MM-DD, appended ONLY when it came from EXIF (dsrc=="EXIF");
            #              the viewer parses this to show "ถ่ายเมื่อ ...". If no EXIF, omit it
            #              (file-mtime is not a reliable shot date, per user decision).
            period_str = "%04d-%02d" % (py_, pm_)
            if dsrc == "EXIF":
                base = "%s_%s_%s" % (meter_no, period_str, dt.strftime("%Y-%m-%d"))
            else:
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
    ren = rename_existing()
    nidx = build_index()
    log("")
    log("Done. moved=%d skipped=%d renamed=%d index=%d" % (moved, skipped, ren, nidx))
    log("Tip: open the VillageMan Bills form, use the suggested path, or copy the")
    log("     printed path above into the bill's Meter photo path field.")


if __name__ == "__main__":
    main()
