@echo off
chcp 65001 >nul
REM ---- v4 (Oct 23 2026): wait for G: (Google Drive) to mount before doing anything, so a
REM     background scheduled run that fires before Drive is ready doesn't fail on missing files.
set "_gtry=0"
:waitG
if exist "G:\" goto :gok
set /a _gtry+=1
if %_gtry% geq 18 (
  echo [%DATE% %TIME%] G: (Google Drive) not mounted - meter photos NOT processed>>"%~dp0gmount_log.txt"
  exit /b 0
)
ping -n 6 127.0.0.1 >nul
goto :waitG
:gok
REM VillageMan - organize common-area meter photos from inbox into meter-photos tree
cd /d "%~dp0"
python organize_meter_photos.py
echo.
echo Done - closing automatically...
REM Auto-close: waits 3s so a manual double-click can glance the result,
REM but never blocks an unattended scheduled run (no Enter needed).
timeout /t 3 >nul
