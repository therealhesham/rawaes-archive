# Make watcher start automatically with Windows (silent background)
# Run with: Right-click → "Run with PowerShell"

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'RawaesScanWatcher.lnk'

$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $scriptDir 'start-watcher-hidden.vbs'
$shortcut.WorkingDirectory = $scriptDir
$shortcut.Description = 'Auto-starts Rawaes Scan Watcher with Windows'
$shortcut.Save()

Write-Host ""
Write-Host "  Auto-start enabled!" -ForegroundColor Green
Write-Host "  Will run silently when Windows starts." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
