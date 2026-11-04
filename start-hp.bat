@echo off
title CodeLyrics Studio - Buka di HP & Laptop
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0server-hp.ps1"
pause
