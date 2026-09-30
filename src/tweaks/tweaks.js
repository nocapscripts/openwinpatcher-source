// All scripts run in PowerShell (admin). Forward slashes are valid in registry paths.
const POL = "HKLM:/SOFTWARE/Policies/Microsoft/Windows";
const set = (p, n, v) => `New-Item -Path '${p}' -Force|Out-Null;Set-ItemProperty -Path '${p}' -Name '${n}' -Value ${v} -Type DWord;`;
const del = (p, n) => `Remove-ItemProperty -Path '${p}' -Name '${n}' -ErrorAction SilentlyContinue;`;
const EXP = "HKCU:/Software/Microsoft/Windows/CurrentVersion/Explorer/Advanced";
const restartExplorer = "Stop-Process -Name explorer -Force;";
const CLSID = "HKCU:/Software/Classes/CLSID/{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}";

export const TWEAKS = [
  { id: "restore", name: "Create Restore Point", desc: "Snapshot the system before changing anything.",
    apply: `Enable-ComputerRestore -Drive "$env:SystemDrive\\";Checkpoint-Computer -Description 'WinUtil' -RestorePointType MODIFY_SETTINGS` },
  { id: "telemetry", name: "Disable Telemetry", desc: "Turns off Windows diagnostic data collection.",
    apply: set(`${POL}/DataCollection`, "AllowTelemetry", 0), undo: del(`${POL}/DataCollection`, "AllowTelemetry") },
  { id: "activity", name: "Disable Activity History", desc: "Stops Windows recording and uploading your activity.",
    apply: ["EnableActivityFeed", "PublishUserActivities", "UploadUserActivities"].map((n) => set(`${POL}/System`, n, 0)).join(""),
    undo: ["EnableActivityFeed", "PublishUserActivities", "UploadUserActivities"].map((n) => del(`${POL}/System`, n)).join("") },
  { id: "consumer", name: "Disable Consumer Features", desc: "Stops automatic installs of suggested apps.",
    apply: set(`${POL}/CloudContent`, "DisableWindowsConsumerFeatures", 1), undo: del(`${POL}/CloudContent`, "DisableWindowsConsumerFeatures") },
  { id: "location", name: "Disable Location Tracking", desc: "Denies location access system-wide.",
    apply: "Set-ItemProperty 'HKLM:/SOFTWARE/Microsoft/Windows/CurrentVersion/CapabilityAccessManager/ConsentStore/location' -Name Value -Value Deny;",
    undo: "Set-ItemProperty 'HKLM:/SOFTWARE/Microsoft/Windows/CurrentVersion/CapabilityAccessManager/ConsentStore/location' -Name Value -Value Allow;" },
  { id: "gamedvr", name: "Disable GameDVR", desc: "Turns off Xbox background game recording.",
    apply: set("HKCU:/System/GameConfigStore", "GameDVR_Enabled", 0) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/GameDVR", "AppCaptureEnabled", 0),
    undo: set("HKCU:/System/GameConfigStore", "GameDVR_Enabled", 1) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/GameDVR", "AppCaptureEnabled", 1) },
  { id: "bing", name: "Disable Bing in Start Menu", desc: "Start search shows local results only.",
    apply: set("HKCU:/Software/Policies/Microsoft/Windows/Explorer", "DisableSearchBoxSuggestions", 1),
    undo: del("HKCU:/Software/Policies/Microsoft/Windows/Explorer", "DisableSearchBoxSuggestions") },
  { id: "widgets", name: "Disable Widgets", desc: "Turns off the News and Interests / Widgets feed.",
    apply: set("HKLM:/SOFTWARE/Policies/Microsoft/Dsh", "AllowNewsAndInterests", 0), undo: del("HKLM:/SOFTWARE/Policies/Microsoft/Dsh", "AllowNewsAndInterests") },
  { id: "pwsh", name: "Disable PowerShell 7 Telemetry", desc: "Sets the machine-wide opt-out variable.",
    apply: "[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT','1','Machine');", undo: "[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT',$null,'Machine');" },
  { id: "hibernate", name: "Disable Hibernation", desc: "Frees disk space used by hiberfil.sys.", apply: "powercfg /hibernate off;", undo: "powercfg /hibernate on;" },
  { id: "ultimate", name: "Add Ultimate Performance Plan", desc: "Creates and activates the Ultimate Performance power plan.",
    apply: "powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61;$g=(powercfg -list|Select-String 'Ultimate'|Select -First 1) -replace '.*: (\\S+).*','$1';powercfg -setactive $g;",
    undo: "powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e;" },
  { id: "temp", name: "Delete Temporary Files", desc: "Clears user and system temp folders.",
    apply: "Remove-Item \"$env:TEMP\\*\",'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue;" },
];

export const FEATURES = [
  [".NET Framework 3.5", "NetFx3"], ["Hyper-V", "Microsoft-Hyper-V-All"], ["Windows Subsystem for Linux", "Microsoft-Windows-Subsystem-Linux"],
  ["Virtual Machine Platform", "VirtualMachinePlatform"], ["Windows Sandbox", "Containers-DisposableClientVM"],
  ["Telnet Client", "TelnetClient"], ["NFS Client", "ServicesForNFS-ClientOnly"],
].map(([name, id]) => ({ id, name, apply: `Enable-WindowsOptionalFeature -Online -FeatureName ${id} -All -NoRestart` }));

export const PREFS = [
  { id: "dark", name: "Dark Theme for Windows",
    on: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Themes/Personalize", "AppsUseLightTheme", 0) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Themes/Personalize", "SystemUsesLightTheme", 0),
    off: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Themes/Personalize", "AppsUseLightTheme", 1) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Themes/Personalize", "SystemUsesLightTheme", 1) },
  { id: "ext", name: "Show File Extensions", on: set(EXP, "HideFileExt", 0) + restartExplorer, off: set(EXP, "HideFileExt", 1) + restartExplorer },
  { id: "hidden", name: "Show Hidden Files", on: set(EXP, "Hidden", 1) + restartExplorer, off: set(EXP, "Hidden", 2) + restartExplorer },
  { id: "classic", name: "Classic Right-Click Menu (Win 11)",
    on: `New-Item '${CLSID}/InprocServer32' -Force|Out-Null;Set-ItemProperty '${CLSID}/InprocServer32' -Name '(default)' -Value '';` + restartExplorer,
    off: `Remove-Item '${CLSID}' -Recurse -Force -ErrorAction SilentlyContinue;` + restartExplorer },
  { id: "search", name: "Hide Taskbar Search Box", on: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Search", "SearchboxTaskbarMode", 0), off: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Search", "SearchboxTaskbarMode", 2) },
  { id: "numlock", name: "NumLock on Startup", on: "Set-ItemProperty 'Registry::HKEY_USERS/.DEFAULT/Control Panel/Keyboard' -Name InitialKeyboardIndicators -Value 2;", off: "Set-ItemProperty 'Registry::HKEY_USERS/.DEFAULT/Control Panel/Keyboard' -Name InitialKeyboardIndicators -Value 0;" },
];

export const FIXES = [
  { name: "Reset Network", desc: "Winsock, IP stack and DNS cache reset.", run: "netsh winsock reset;netsh int ip reset;ipconfig /flushdns;" },
  { name: "Reset Windows Update", desc: "Stops services and clears the update cache.",
    run: "Stop-Service wuauserv,bits,cryptsvc -Force;Remove-Item C:/Windows/SoftwareDistribution -Recurse -Force -ErrorAction SilentlyContinue;Start-Service wuauserv,bits,cryptsvc;" },
  { name: "System Corruption Scan", desc: "Runs DISM RestoreHealth then SFC.", run: "DISM /Online /Cleanup-Image /RestoreHealth;sfc /scannow;" },
  { name: "Flush DNS Cache", desc: "Clears the resolver cache.", run: "Clear-DnsClientCache;" },
];

export const PANELS = [
  ["Control Panel", "control"], ["Network Connections", "ncpa.cpl"], ["Sound", "mmsys.cpl"], ["System Properties", "sysdm.cpl"],
  ["Power Options", "powercfg.cpl"], ["Programs and Features", "appwiz.cpl"], ["Services", "services.msc"],
  ["Device Manager", "devmgmt.msc"], ["Disk Management", "diskmgmt.msc"], ["Task Scheduler", "taskschd.msc"],
].map(([name, cmd]) => ({ name, run: `Start-Process ${cmd}` }));

const WU = "HKLM:/SOFTWARE/Policies/Microsoft/Windows/WindowsUpdate";
export const UPDATES = [
  { name: "Default (Out of Box)", desc: "Removes all update policies; Windows decides.",
    run: `Remove-Item '${WU}' -Recurse -Force -ErrorAction SilentlyContinue;Set-Service wuauserv -StartupType Manual;` },
  { name: "Security (Recommended)", desc: "Feature updates deferred 365 days, security updates 4 days.",
    run: set(WU, "DeferFeatureUpdates", 1) + set(WU, "DeferFeatureUpdatesPeriodInDays", 365) + set(WU, "DeferQualityUpdates", 1) + set(WU, "DeferQualityUpdatesPeriodInDays", 4) + "Set-Service wuauserv -StartupType Manual;" },
  { name: "Disable All Updates", desc: "Not recommended: you stop receiving security fixes.", danger: true,
    run: set(`${WU}/AU`, "NoAutoUpdate", 1) + "Stop-Service wuauserv -Force;Set-Service wuauserv -StartupType Disabled;" },
];
