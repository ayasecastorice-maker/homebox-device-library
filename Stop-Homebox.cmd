@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-Homebox.ps1"
if errorlevel 1 pause
