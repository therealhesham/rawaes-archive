#Requires -Version 5.0
<#
.SYNOPSIS
  Rawaes Scanner Watcher - One-line installer
.DESCRIPTION
  Installs Python (if missing), downloads watcher files,
  configures, creates shortcuts, and adds to Windows startup.
.EXAMPLE
  irm https://raw.githubusercontent.com/NourAlasmar/rawaes-archive/main/scanner-watcher/install.ps1 | iex
#>

$ErrorActionPreference = 'Stop'
$InstallDir = "$env:LOCALAPPDATA\RawaesWatcher"
$RepoRaw = 'https://raw.githubusercontent.com/NourAlasmar/rawaes-archive/main/scanner-watcher'

# UTF-8 console for Arabic
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════╗" -ForegroundColor DarkYellow
    Write-Host "  ║                                            ║" -ForegroundColor DarkYellow
    Write-Host "  ║      Rawaes Scanner Watcher Installer      ║" -ForegroundColor Yellow
    Write-Host "  ║          روائس - مراقب السكانر             ║" -ForegroundColor Yellow
    Write-Host "  ║                                            ║" -ForegroundColor DarkYellow
    Write-Host "  ╚════════════════════════════════════════════╝" -ForegroundColor DarkYellow
    Write-Host ""
}

function Step($num, $text) {
    Write-Host ""
    Write-Host "  [$num] $text" -ForegroundColor Cyan
}

function OK($text) {
    Write-Host "      ✓ $text" -ForegroundColor Green
}

function Warn($text) {
    Write-Host "      ⚠ $text" -ForegroundColor Yellow
}

function Fail($text) {
    Write-Host "      ✗ $text" -ForegroundColor Red
}

# ─────────────────────────────────────────
Write-Header

# Step 1: Python check
Step 1 "Checking Python..."
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Warn "Python not found. Downloading installer..."
    $pyUrl = 'https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe'
    $pyExe = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri $pyUrl -OutFile $pyExe
    Write-Host "      Installing Python silently (will take 1-2 minutes)..." -ForegroundColor Gray
    Start-Process -FilePath $pyExe -Args '/quiet InstallAllUsers=0 PrependPath=1 Include_test=0' -Wait
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
    OK "Python installed"
} else {
    OK ("Python found: " + (& python --version 2>&1))
}

# Step 2: Create install dir
Step 2 "Creating install folder..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
OK $InstallDir

# Step 3: Download files
Step 3 "Downloading watcher files..."
$files = @('watcher.py', 'scan_bridge.py')
foreach ($f in $files) {
    Invoke-WebRequest -Uri "$RepoRaw/$f" -OutFile "$InstallDir\$f"
    OK $f
}

# Step 4: Install pip dependencies
Step 4 "Installing Python packages..."
$packages = @('requests', 'watchdog', 'flask', 'flask-cors', 'pywin32', 'pillow')
$pipArgs = @('-m', 'pip', 'install', '--quiet', '--disable-pip-version-check') + $packages
& python @pipArgs 2>&1 | Out-Null
OK "Packages installed"

# Step 5: Configuration wizard
Step 5 "Configuration"
Write-Host ""

$serverUrl = Read-Host "      رابط النظام (مثال: http://45.63.117.248)"
if (-not $serverUrl) { $serverUrl = 'http://45.63.117.248' }

$apiToken = Read-Host "      API Token"
while (-not $apiToken) {
    $apiToken = Read-Host "      Token مطلوب! API Token"
}

$deviceName = Read-Host "      اسم هذا الجهاز (مثال: Office-PC-1)"
if (-not $deviceName) { $deviceName = "PC-$env:COMPUTERNAME" }

$watchFolder = Read-Host "      مجلد السكانر (افتراضي: C:\Scans)"
if (-not $watchFolder) { $watchFolder = 'C:\Scans' }

$scannerName = Read-Host "      اسم السكانر المفضّل [اختياري - مثل: scanjet]"
$scanSource = Read-Host "      مصدر المسح [feeder=الدرج, flatbed=الزجاج] (افتراضي: feeder)"
if (-not $scanSource) { $scanSource = 'feeder' }

# Ensure watch folder exists
New-Item -ItemType Directory -Force -Path $watchFolder | Out-Null

# Write config.ini
$configContent = @"
[main]
watch_folder = $watchFolder
api_url = $serverUrl
api_token = $apiToken
device_name = $deviceName
processed_folder = processed
bridge_enabled = true
bridge_port = 9999
preferred_scanner = $scannerName
scan_source = $scanSource
"@
[System.IO.File]::WriteAllText("$InstallDir\config.ini", $configContent, [System.Text.UTF8Encoding]::new($false))
OK "Configuration saved"

# Step 6: Create launchers
Step 6 "Creating shortcuts..."

# Visible launcher (BAT)
$batContent = @"
@echo off
title Rawaes Scanner Watcher
cd /d "$InstallDir"
python watcher.py
pause
"@
[System.IO.File]::WriteAllText("$InstallDir\start.bat", $batContent, [System.Text.ASCIIEncoding]::new())

# Hidden launcher (VBS)
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$InstallDir"
WshShell.Run "python watcher.py", 0, False
"@
[System.IO.File]::WriteAllText("$InstallDir\start-hidden.vbs", $vbsContent, [System.Text.ASCIIEncoding]::new())

# Desktop shortcut (visible)
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell
$desktopShortcut = $ws.CreateShortcut("$desktop\Rawaes Scanner.lnk")
$desktopShortcut.TargetPath = "$InstallDir\start.bat"
$desktopShortcut.WorkingDirectory = $InstallDir
$desktopShortcut.IconLocation = 'imageres.dll,176'
$desktopShortcut.Description = 'Rawaes Scanner Watcher'
$desktopShortcut.Save()
OK "Desktop shortcut created"

# Startup shortcut (hidden, runs at login)
$startup = [Environment]::GetFolderPath('Startup')
$startupShortcut = $ws.CreateShortcut("$startup\RawaesWatcher.lnk")
$startupShortcut.TargetPath = "$InstallDir\start-hidden.vbs"
$startupShortcut.WorkingDirectory = $InstallDir
$startupShortcut.Description = 'Auto-start Rawaes Scanner Watcher'
$startupShortcut.Save()
OK "Auto-start enabled"

# Step 7: Optional first run
Step 7 "Done!"
Write-Host ""
Write-Host "  ┌────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │  ✓ التثبيت اكتمل بنجاح                      │" -ForegroundColor Green
Write-Host "  │                                            │" -ForegroundColor Green
Write-Host "  │  المجلد: $InstallDir" -ForegroundColor Gray
Write-Host "  │                                            │" -ForegroundColor Green
Write-Host "  └────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""

$run = Read-Host "  هل تريد تشغيل المراقب الآن؟ [y/N]"
if ($run -match '^[yY]') {
    Start-Process -FilePath "$InstallDir\start.bat"
    OK "Started!"
}

Write-Host ""
Write-Host "  Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
