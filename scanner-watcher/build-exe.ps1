$ErrorActionPreference = "Stop"

Write-Host "== Rawaes Watcher EXE Build ==" -ForegroundColor Cyan

Set-Location -Path $PSScriptRoot

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python not found. Install Python 3.8+ first."
}

python -m pip install --upgrade pip
python -m pip install pyinstaller requests watchdog flask flask-cors pywin32 pillow

pyinstaller --noconfirm --onefile --windowed `
  --name "RawaesWatcher" `
  --add-data "config.ini.example;." `
  --add-data "watcher.py;." `
  --add-data "scan_bridge.py;." `
  gui_app.py

Write-Host "Built: dist\\RawaesWatcher.exe" -ForegroundColor Green

