@echo off
chcp 65001 >nul
REM VillageMan - organize common-area meter photos from inbox into meter-photos tree
cd /d "%~dp0"
python organize_meter_photos.py
echo.
echo Done - closing automatically...
REM Auto-close: waits 3s so a manual double-click can glance the result,
REM but never blocks an unattended scheduled run (no Enter needed).
timeout /t 3 >nul
