@echo off
if not exist "%~dp0.runtime\desktop\Homebox.exe" (
  echo Homebox desktop launcher is missing. Run Build-Launcher.ps1 first.
  pause
  exit /b 1
)
start "" "%~dp0.runtime\desktop\Homebox.exe"
