@echo off
title CodeLyrics Studio - TikTok Coding Song Trend
cd /d "%~dp0"
echo ========================================================
echo   Membuka CodeLyrics Studio di Web Browser...
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
