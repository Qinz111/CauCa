@echo off
title Game Cau Ca 3D - TikTok Live App
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=

echo ===================================================
echo     DANG KHOI DONG GAME CAU CA 3D (DANG NATIVE APP)
echo ===================================================
echo.
echo Cua so ung dung man hinh doc dien thoai se xuat hien ngay.
echo Trong TikTok LIVE Studio hoac OBS:
echo   - Bam "Them Nguon" (Add Source) -^> Chon "Cua so" (Window Capture)
echo   - Chon cua so: "Game Cau Ca 3D -- TikTok Live Game"
echo.

if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
) else (
    start "" "msedge.exe" --app="http://localhost:3000" --window-size=506,900
)
