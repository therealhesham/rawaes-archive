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
  --add-data "scan_bridge.py;." `
  gui_app.py

pyinstaller --noconfirm --onefile `
  --name "RawaesWatcherWorker" `
  --add-data "config.ini.example;." `
  --add-data "scan_bridge.py;." `
  watcher_worker.py

Write-Host "Built: dist\\RawaesWatcher.exe" -ForegroundColor Green
Write-Host "Built: dist\\RawaesWatcherWorker.exe" -ForegroundColor Green

$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) {
  $iscc = "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
}

if (Test-Path $iscc) {
  & $iscc "$PSScriptRoot\RawaesWatcherSetup.iss"
  Write-Host "Built: dist\\RawaesWatcherSetup.exe" -ForegroundColor Green
} else {
  Write-Host "Inno Setup not found. Skipping installer build." -ForegroundColor Yellow
  Write-Host "Install Inno Setup 6 to generate: dist\\RawaesWatcherSetup.exe" -ForegroundColor Yellow
}
