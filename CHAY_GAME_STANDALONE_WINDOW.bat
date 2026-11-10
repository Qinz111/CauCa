@echo off
title Game Cau Ca 3D - Standalone Window
cd /d "%~dp0"
start "" "msedge.exe" --app="http://localhost:3000" --window-size=506,900 --user-data-dir="%~dp0.cache\app-profile"

