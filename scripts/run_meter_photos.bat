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
REM ---- v5 (Oct 24 2026): locate Python robustly for background runs (PATH may differ when the
REM     task runs 'whether user is logged on or not'). Try python -> py -3 -> common install paths.
set "PY="
if exist "C:\Users\USER\AppData\Local\Python\pythoncore-3.14-64\python.exe" set "PY=C:\Users\USER\AppData\Local\Python\pythoncore-3.14-64\python.exe"
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY=%LocalAppData%\Programs\Python\Python311\python.exe"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python310\python.exe" set "PY=%LocalAppData%\Programs\Python\Python310\python.exe"
if not defined PY if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if not defined PY if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"
if not defined PY (
  echo [%DATE% %TIME%] python not found - meter photos NOT processed>>"%~dp0gmount_log.txt"
  exit /b 0
)
"%PY%" organize_meter_photos.py

echo.
echo Done - closing automatically...
REM Auto-close: waits 3s so a manual double-click can glance the result,
REM but never blocks an unattended scheduled run (no Enter needed).
ping -n 4 127.0.0.1 >nul
exit /b 0
