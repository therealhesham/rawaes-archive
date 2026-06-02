# Create desktop shortcut for the scan watcher
# Run with: Right-click → "Run with PowerShell"

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Rawaes Scan Watcher.lnk'

$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $scriptDir 'start-watcher.bat'
$shortcut.WorkingDirectory = $scriptDir
$shortcut.IconLocation = 'imageres.dll,176'
$shortcut.Description = 'Rawaes Scan Watcher - uploads scans automatically'
$shortcut.Save()

Write-Host ""
Write-Host "  Desktop shortcut created!" -ForegroundColor Green
Write-Host "  Name: Rawaes Scan Watcher" -ForegroundColor Yellow
Write-Host "  Location: $desktop" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
