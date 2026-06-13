[Setup]
AppId={{A9B6399D-31B1-4D65-B935-2A53A5E4F212}
AppName=Rawaes Scanner Watcher
AppVersion=1.0.0
AppPublisher=Rawaes
DefaultDirName={localappdata}\RawaesWatcher
DefaultGroupName=Rawaes Scanner Watcher
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=RawaesWatcherSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Files]
Source: "dist\RawaesWatcher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\RawaesWatcherWorker.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "config.ini.example"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist
Source: "config.ini.example"; DestDir: "{app}"; DestName: "config.ini"; Flags: ignoreversion onlyifdoesntexist

[Icons]
Name: "{autodesktop}\Rawaes Scanner Watcher"; Filename: "{app}\RawaesWatcher.exe"
Name: "{userstartup}\Rawaes Scanner Watcher"; Filename: "{app}\RawaesWatcher.exe"

[Dirs]
Name: "{userdocs}\Rawaes Scans"

[Run]
Filename: "{app}\RawaesWatcher.exe"; Description: "تشغيل البرنامج الآن"; Flags: nowait postinstall skipifsilent
