// All scripts run in PowerShell (admin). Forward slashes are valid in registry paths.
// Flags used by the UI:  rec = part of the "Recommended" preset,  danger = show a warning,  reboot = needs restart/sign-out.

// ---------- helpers ----------
const POL = "HKLM:/SOFTWARE/Policies/Microsoft/Windows";
const EXP = "HKCU:/Software/Microsoft/Windows/CurrentVersion/Explorer/Advanced";
const CDM = "HKCU:/Software/Microsoft/Windows/CurrentVersion/ContentDeliveryManager";
const PERS = "HKCU:/Software/Microsoft/Windows/CurrentVersion/Themes/Personalize";
const EDGE = "HKLM:/SOFTWARE/Policies/Microsoft/Edge";
const CLSID = "HKCU:/Software/Classes/CLSID/{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}";
const restartExplorer = "Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue;";

// Create the key only if missing (never wipes existing values), then write the value.
const set = (p, n, v, t = "DWord") =>
  `if(!(Test-Path '${p}')){New-Item -Path '${p}' -Force|Out-Null};` +
  `New-ItemProperty -Path '${p}' -Name '${n}' -Value ${t === "String" ? `'${v}'` : v} -PropertyType ${t} -Force|Out-Null;`;
const setMany = (p, names, v) => names.map((n) => set(p, n, v)).join("");
const del = (p, n) => `Remove-ItemProperty -Path '${p}' -Name '${n}' -ErrorAction SilentlyContinue;`;
const delMany = (p, names) => names.map((n) => del(p, n)).join("");

const svcOff = (...names) =>
  names.map((s) => `Stop-Service '${s}' -Force -ErrorAction SilentlyContinue;Set-Service '${s}' -StartupType Disabled -ErrorAction SilentlyContinue;`).join("");
const svcOn = (mode, ...names) =>
  names.map((s) => `Set-Service '${s}' -StartupType ${mode} -ErrorAction SilentlyContinue;Start-Service '${s}' -ErrorAction SilentlyContinue;`).join("");
const tasks = (list, enable) =>
  list.map((t) => `schtasks /Change /TN '${t}' /${enable ? "ENABLE" : "DISABLE"} 2>$null|Out-Null;`).join("");

// ---------- app debloat ----------
// Removes the app for all users AND de-provisions it so new accounts / feature updates don't bring it back.
// Names support wildcards. Core apps (Store, Calculator, Photos, Notepad, Paint, Terminal, Snipping Tool, Edge) are never listed.
export const removeApps = (pkgs) =>
  `$pk=@(${pkgs.map((p) => `'${p}'`).join(",")});` +
  `foreach($n in $pk){` +
  `Get-AppxPackage -AllUsers -Name $n -ErrorAction SilentlyContinue|Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue;` +
  `Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue|Where-Object{$_.DisplayName -like $n}|Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue|Out-Null` +
  `};`;

// group: games | promo | social | optional | xbox     rec = ticked by default in the "Recommended" preset
export const BLOAT = [
  // --- Games & junk ---
  { pkg: "Microsoft.MicrosoftSolitaireCollection", name: "Solitaire Collection", group: "games", rec: true },
  { pkg: "king.com.*", name: "Candy Crush & other King games", group: "games", rec: true },
  { pkg: "Microsoft.MicrosoftMinesweeper", name: "Minesweeper", group: "games", rec: true },
  { pkg: "Microsoft.MicrosoftMahjong", name: "Mahjong", group: "games", rec: true },
  { pkg: "*FarmVille*", name: "FarmVille", group: "games", rec: true },
  { pkg: "*HiddenCity*", name: "Hidden City", group: "games", rec: true },
  { pkg: "A278AB0D.MarchofEmpires", name: "March of Empires", group: "games", rec: true },
  { pkg: "GAMELOFTSA.*", name: "Gameloft games (Asphalt etc.)", group: "games", rec: true },
  { pkg: "*DragonManiaLegends*", name: "Dragon Mania Legends", group: "games", rec: true },
  { pkg: "*RoyalRevolt*", name: "Royal Revolt", group: "games", rec: true },
  { pkg: "*BubbleWitch*", name: "Bubble Witch", group: "games", rec: true },
  { pkg: "*Wordament*", name: "Wordament", group: "games", rec: true },

  // --- Sponsored / third-party promo apps ---
  { pkg: "SpotifyAB.SpotifyMusic", name: "Spotify (preinstalled stub)", group: "social", rec: true },
  { pkg: "4DF9E0F8.Netflix", name: "Netflix", group: "social", rec: true },
  { pkg: "Disney.*", name: "Disney+", group: "social", rec: true },
  { pkg: "AmazonVideo.PrimeVideo", name: "Prime Video", group: "social", rec: true },
  { pkg: "*Hulu*", name: "Hulu", group: "social", rec: true },
  { pkg: "*Facebook*", name: "Facebook", group: "social", rec: true },
  { pkg: "*Instagram*", name: "Instagram", group: "social", rec: true },
  { pkg: "*TikTok*", name: "TikTok", group: "social", rec: true },
  { pkg: "*Twitter*", name: "Twitter / X", group: "social", rec: true },
  { pkg: "*LinkedIn*", name: "LinkedIn", group: "social", rec: true },
  { pkg: "*Duolingo*", name: "Duolingo", group: "social", rec: true },
  { pkg: "*Pandora*", name: "Pandora", group: "social", rec: true },
  { pkg: "*Flipboard*", name: "Flipboard", group: "social", rec: true },
  { pkg: "*iHeartRadio*", name: "iHeartRadio", group: "social", rec: true },
  { pkg: "*PicsArt*", name: "PicsArt", group: "social", rec: true },
  { pkg: "*AdobePhotoshopExpress*", name: "Photoshop Express", group: "social", rec: true },
  { pkg: "*EclipseManager*", name: "Eclipse Manager", group: "social", rec: true },
  { pkg: "*ActiproSoftwareLLC*", name: "Actipro Software", group: "social", rec: true },
  { pkg: "*McAfee*", name: "McAfee trial", group: "social", rec: true },

  // --- Microsoft promo / unused apps ---
  { pkg: "Microsoft.BingNews", name: "News", group: "promo", rec: true },
  { pkg: "Microsoft.BingWeather", name: "Weather", group: "promo", rec: true },
  { pkg: "Microsoft.BingFinance", name: "Money", group: "promo", rec: true },
  { pkg: "Microsoft.BingSports", name: "Sports", group: "promo", rec: true },
  { pkg: "Microsoft.BingSearch", name: "Bing Search", group: "promo", rec: true },
  { pkg: "Microsoft.MicrosoftOfficeHub", name: "Microsoft 365 (Office hub)", group: "promo", rec: true },
  { pkg: "Microsoft.Getstarted", name: "Tips", group: "promo", rec: true },
  { pkg: "Microsoft.GetHelp", name: "Get Help", group: "promo", rec: true },
  { pkg: "Microsoft.WindowsFeedbackHub", name: "Feedback Hub", group: "promo", rec: true },
  { pkg: "Microsoft.549981C3F5F10", name: "Cortana", group: "promo", rec: true },
  { pkg: "Microsoft.Copilot", name: "Copilot app", group: "promo", rec: true },
  { pkg: "Microsoft.People", name: "People", group: "promo", rec: true },
  { pkg: "Microsoft.SkypeApp", name: "Skype", group: "promo", rec: true },
  { pkg: "Microsoft.MixedReality.Portal", name: "Mixed Reality Portal", group: "promo", rec: true },
  { pkg: "Microsoft.Microsoft3DViewer", name: "3D Viewer", group: "promo", rec: true },
  { pkg: "Microsoft.Print3D", name: "Print 3D", group: "promo", rec: true },
  { pkg: "Microsoft.Wallet", name: "Wallet", group: "promo", rec: true },
  { pkg: "Microsoft.OneConnect", name: "Mobile Plans", group: "promo", rec: true },
  { pkg: "Microsoft.Messaging", name: "Messaging", group: "promo", rec: true },
  { pkg: "Microsoft.Advertising.Xaml", name: "Advertising framework", group: "promo", rec: true },
  { pkg: "Microsoft.Windows.DevHome", name: "Dev Home", group: "promo", rec: true },
  { pkg: "Microsoft.PowerAutomateDesktop", name: "Power Automate", group: "promo", rec: true },
  { pkg: "Clipchamp.Clipchamp", name: "Clipchamp", group: "promo", rec: true },
  { pkg: "MicrosoftTeams", name: "Teams (personal, old)", group: "promo", rec: true },
  { pkg: "MSTeams", name: "Teams (personal, new)", group: "promo", rec: true },

  // --- Optional: useful to some people, so NOT ticked by default ---
  { pkg: "Microsoft.YourPhone", name: "Phone Link", group: "optional" },
  { pkg: "Microsoft.Todos", name: "Microsoft To Do", group: "optional" },
  { pkg: "Microsoft.MicrosoftJournal", name: "Journal", group: "optional" },
  { pkg: "Microsoft.MicrosoftStickyNotes", name: "Sticky Notes", group: "optional" },
  { pkg: "Microsoft.WindowsMaps", name: "Maps", group: "optional" },
  { pkg: "Microsoft.WindowsAlarms", name: "Alarms & Clock", group: "optional" },
  { pkg: "Microsoft.WindowsSoundRecorder", name: "Sound Recorder", group: "optional" },
  { pkg: "Microsoft.WindowsCommunicationsApps", name: "Mail & Calendar (old)", group: "optional" },
  { pkg: "Microsoft.OutlookForWindows", name: "Outlook (new)", group: "optional" },
  { pkg: "Microsoft.ZuneMusic", name: "Media Player", group: "optional" },
  { pkg: "Microsoft.ZuneVideo", name: "Movies & TV", group: "optional" },
  { pkg: "MicrosoftCorporationII.QuickAssist", name: "Quick Assist", group: "optional" },
  { pkg: "MicrosoftCorporationII.MicrosoftFamily", name: "Microsoft Family", group: "optional" },

  // --- Xbox: removing these breaks Game Pass, Xbox sign-in and many Store games ---
  { pkg: "Microsoft.GamingApp", name: "Xbox app", group: "xbox", danger: true },
  { pkg: "Microsoft.XboxGamingOverlay", name: "Xbox Game Bar", group: "xbox", danger: true },
  { pkg: "Microsoft.XboxGameOverlay", name: "Xbox Game Overlay", group: "xbox", danger: true },
  { pkg: "Microsoft.XboxSpeechToTextOverlay", name: "Xbox Speech-to-Text", group: "xbox", danger: true },
  { pkg: "Microsoft.Xbox.TCUI", name: "Xbox TCUI", group: "xbox", danger: true },
  { pkg: "Microsoft.XboxIdentityProvider", name: "Xbox Identity Provider", group: "xbox", danger: true },
];

export const BLOAT_PRESETS = {
  recommended: BLOAT.filter((a) => a.rec).map((a) => a.pkg), // games + promo + third-party junk
  gamesOnly: BLOAT.filter((a) => a.group === "games").map((a) => a.pkg),
  everything: BLOAT.filter((a) => a.group !== "xbox").map((a) => a.pkg), // all but Xbox
};

// One-click: remove a list of packages (defaults to the recommended preset).
export const debloatScript = (pkgs = BLOAT_PRESETS.recommended) => removeApps(pkgs);

// ---------- tweaks ----------
const ADS_KEYS = [
  "ContentDeliveryAllowed", "OemPreInstalledAppsEnabled", "PreInstalledAppsEnabled", "PreInstalledAppsEverEnabled",
  "SilentInstalledAppsEnabled", "SystemPaneSuggestionsEnabled", "SoftLandingEnabled", "RotatingLockScreenOverlayEnabled",
  "SubscribedContent-310093Enabled", "SubscribedContent-338387Enabled", "SubscribedContent-338388Enabled",
  "SubscribedContent-338389Enabled", "SubscribedContent-338393Enabled", "SubscribedContent-353694Enabled",
  "SubscribedContent-353696Enabled", "SubscribedContent-353698Enabled", "SubscribedContent-88000326Enabled",
];
export const ACT_KEYS = ["EnableActivityFeed", "PublishUserActivities", "UploadUserActivities"];
export const TELE_TASKS = [
  "Microsoft\\Windows\\Application Experience\\Microsoft Compatibility Appraiser",
  "Microsoft\\Windows\\Application Experience\\ProgramDataUpdater",
  "Microsoft\\Windows\\Application Experience\\StartupAppTask",
  "Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator",
  "Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip",
  "Microsoft\\Windows\\DiskDiagnostic\\Microsoft-Windows-DiskDiagnosticDataCollector",
  "Microsoft\\Windows\\Feedback\\Siuf\\DmClient",
  "Microsoft\\Windows\\Feedback\\Siuf\\DmClientOnScenarioDownload",
];
const LOC = "HKLM:/SOFTWARE/Microsoft/Windows/CurrentVersion/CapabilityAccessManager/ConsentStore/location";
const EDGE_POLICIES = {
  HideFirstRunExperience: 1, StartupBoostEnabled: 0, BackgroundModeEnabled: 0, EdgeShoppingAssistantEnabled: 0,
  ShowMicrosoftRewards: 0, HubsSidebarEnabled: 0, PersonalizationReportingEnabled: 0, EdgeFollowEnabled: 0,
  DiscoverPageContextEnabled: 0, ShowRecommendationsEnabled: 0, SpotlightExperiencesAndRecommendationsEnabled: 0,
};

export const TWEAKS = [
  // --- Safety ---
  { id: "restore", cat: "Safety", name: "Create Restore Point", rec: true, desc: "Snapshot the system before changing anything.",
    apply: `Enable-ComputerRestore -Drive "$env:SystemDrive\\";` +
      set("HKLM:/SOFTWARE/Microsoft/Windows NT/CurrentVersion/SystemRestore", "SystemRestorePointCreationFrequency", 0) +
      "Checkpoint-Computer -Description 'Open Windows Patcher' -RestorePointType MODIFY_SETTINGS" },

  // --- Privacy ---
  { id: "telemetry", cat: "Privacy", name: "Disable Telemetry", rec: true, desc: "Policy off + stops the DiagTrack and dmwappush services.",
    apply: set(`${POL}/DataCollection`, "AllowTelemetry", 0) + set(`${POL}/DataCollection`, "DoNotShowFeedbackNotifications", 1) + svcOff("DiagTrack", "dmwappushservice"),
    undo: del(`${POL}/DataCollection`, "AllowTelemetry") + del(`${POL}/DataCollection`, "DoNotShowFeedbackNotifications") + svcOn("Automatic", "DiagTrack") + svcOn("Manual", "dmwappushservice") },
  { id: "teletasks", cat: "Privacy", name: "Disable Telemetry Scheduled Tasks", rec: true, desc: "Turns off compatibility appraiser, CEIP and feedback tasks.",
    apply: tasks(TELE_TASKS, false), undo: tasks(TELE_TASKS, true) },
  { id: "activity", cat: "Privacy", name: "Disable Activity History", rec: true, desc: "Stops Windows recording and uploading your activity.",
    apply: setMany(`${POL}/System`, ACT_KEYS, 0), undo: delMany(`${POL}/System`, ACT_KEYS) },
  { id: "adid", cat: "Privacy", name: "Disable Advertising ID", rec: true, desc: "No per-user ad profile shared with apps.",
    apply: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/AdvertisingInfo", "Enabled", 0) + set(`${POL}/AdvertisingInfo`, "DisabledByGroupPolicy", 1),
    undo: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/AdvertisingInfo", "Enabled", 1) + del(`${POL}/AdvertisingInfo`, "DisabledByGroupPolicy") },
  { id: "location", cat: "Privacy", name: "Disable Location Tracking", desc: "Denies location access system-wide.",
    apply: set(LOC, "Value", "Deny", "String"), undo: set(LOC, "Value", "Allow", "String") },
  { id: "errorrep", cat: "Privacy", name: "Disable Error Reporting", desc: "Stops crash reports being sent to Microsoft.",
    apply: set(`${POL}/Windows Error Reporting`, "Disabled", 1) + svcOff("WerSvc"),
    undo: del(`${POL}/Windows Error Reporting`, "Disabled") + svcOn("Manual", "WerSvc") },
  { id: "pwsh", cat: "Privacy", name: "Disable PowerShell 7 Telemetry", rec: true, desc: "Sets the machine-wide opt-out variable.",
    apply: "[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT','1','Machine');",
    undo: "[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT',$null,'Machine');" },

  // --- Debloat ---
  { id: "consumer", cat: "Debloat", name: "Disable Consumer Features", rec: true, desc: "Stops automatic installs of suggested apps (Candy Crush etc. coming back).",
    apply: setMany(`${POL}/CloudContent`, ["DisableWindowsConsumerFeatures", "DisableSoftLanding", "DisableCloudOptimizedContent"], 1),
    undo: delMany(`${POL}/CloudContent`, ["DisableWindowsConsumerFeatures", "DisableSoftLanding", "DisableCloudOptimizedContent"]) },
  { id: "ads", cat: "Debloat", name: "Disable Start, Lock Screen & Settings Ads", rec: true, desc: "Removes suggested apps, tips and promoted content.",
    apply: setMany(CDM, ADS_KEYS, 0) + set(EXP, "ShowSyncProviderNotifications", 0) + set(EXP, "Start_IrisRecommendations", 0),
    undo: setMany(CDM, ADS_KEYS, 1) + set(EXP, "ShowSyncProviderNotifications", 1) + set(EXP, "Start_IrisRecommendations", 1) },
  { id: "bing", cat: "Debloat", name: "Disable Bing in Start Menu", rec: true, desc: "Start search shows local results only.",
    apply: set("HKCU:/Software/Policies/Microsoft/Windows/Explorer", "DisableSearchBoxSuggestions", 1) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Search", "BingSearchEnabled", 0),
    undo: del("HKCU:/Software/Policies/Microsoft/Windows/Explorer", "DisableSearchBoxSuggestions") + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Search", "BingSearchEnabled", 1) },
  { id: "widgets", cat: "Debloat", name: "Disable Widgets", rec: true, desc: "Turns off the Widgets / News and Interests feed.",
    apply: set("HKLM:/SOFTWARE/Policies/Microsoft/Dsh", "AllowNewsAndInterests", 0), undo: del("HKLM:/SOFTWARE/Policies/Microsoft/Dsh", "AllowNewsAndInterests") },
  { id: "chat", cat: "Debloat", name: "Disable Teams Chat Icon", rec: true, desc: "Removes the Chat button and its taskbar entry.",
    apply: set(`${POL}/Windows Chat`, "ChatIcon", 3), undo: del(`${POL}/Windows Chat`, "ChatIcon") },
  { id: "copilot", cat: "Debloat", name: "Disable Copilot", rec: true, desc: "Policy off for Windows Copilot, user and machine.",
    apply: set("HKCU:/Software/Policies/Microsoft/Windows/WindowsCopilot", "TurnOffWindowsCopilot", 1) + set(`${POL}/WindowsCopilot`, "TurnOffWindowsCopilot", 1),
    undo: del("HKCU:/Software/Policies/Microsoft/Windows/WindowsCopilot", "TurnOffWindowsCopilot") + del(`${POL}/WindowsCopilot`, "TurnOffWindowsCopilot") },
  { id: "recall", cat: "Debloat", name: "Disable Recall (AI snapshots)", rec: true, desc: "Blocks AI data analysis and removes the Recall feature where present.",
    apply: set(`${POL}/WindowsAI`, "DisableAIDataAnalysis", 1) + "Disable-WindowsOptionalFeature -Online -FeatureName Recall -NoRestart -ErrorAction SilentlyContinue|Out-Null;",
    undo: del(`${POL}/WindowsAI`, "DisableAIDataAnalysis") },
  { id: "edge", cat: "Debloat", name: "Tame Microsoft Edge", desc: "Kills startup boost, background mode, sidebar, shopping and rewards nags.",
    apply: Object.entries(EDGE_POLICIES).map(([n, v]) => set(EDGE, n, v)).join(""),
    undo: Object.keys(EDGE_POLICIES).map((n) => del(EDGE, n)).join("") },
  { id: "onedrive", cat: "Debloat", name: "Uninstall OneDrive", danger: true, desc: "Removes OneDrive. Make sure nothing syncs through it first.",
    apply: "taskkill /f /im OneDrive.exe 2>$null;$s=\"$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe\";if(!(Test-Path $s)){$s=\"$env:SystemRoot\\System32\\OneDriveSetup.exe\"};if(Test-Path $s){Start-Process $s '/uninstall' -Wait};",
    undo: "$s=\"$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe\";if(!(Test-Path $s)){$s=\"$env:SystemRoot\\System32\\OneDriveSetup.exe\"};if(Test-Path $s){Start-Process $s};" },
  { id: "debloat", cat: "Debloat", name: "Remove Preinstalled Apps (recommended list)", rec: true,
    desc: "Solitaire, Candy Crush, promo apps, Bing apps, Clipchamp, Teams etc. Xbox apps are kept. Reinstall via the Store.",
    apply: debloatScript() },

  // --- Performance ---
  { id: "gamedvr", cat: "Performance", name: "Disable GameDVR", rec: true, desc: "Turns off Xbox background game recording.",
    apply: set("HKCU:/System/GameConfigStore", "GameDVR_Enabled", 0) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/GameDVR", "AppCaptureEnabled", 0) + set(`${POL}/GameDVR`, "AllowGameDVR", 0),
    undo: set("HKCU:/System/GameConfigStore", "GameDVR_Enabled", 1) + set("HKCU:/Software/Microsoft/Windows/CurrentVersion/GameDVR", "AppCaptureEnabled", 1) + del(`${POL}/GameDVR`, "AllowGameDVR") },
  { id: "gamemode", cat: "Performance", name: "Enable Game Mode", rec: true, desc: "Prioritises the foreground game.",
    apply: set("HKCU:/Software/Microsoft/GameBar", "AutoGameModeEnabled", 1), undo: set("HKCU:/Software/Microsoft/GameBar", "AutoGameModeEnabled", 0) },
  { id: "hags", cat: "Performance", name: "Hardware-Accelerated GPU Scheduling", reboot: true, desc: "Lets the GPU manage its own memory scheduling (needs a supported GPU).",
    apply: set("HKLM:/SYSTEM/CurrentControlSet/Control/GraphicsDrivers", "HwSchMode", 2), undo: set("HKLM:/SYSTEM/CurrentControlSet/Control/GraphicsDrivers", "HwSchMode", 1) },
  { id: "delivery", cat: "Performance", name: "Disable Delivery Optimization", desc: "Stops uploading Windows updates to other PCs.",
    apply: set(`${POL}/DeliveryOptimization`, "DODownloadMode", 0), undo: del(`${POL}/DeliveryOptimization`, "DODownloadMode") },
  { id: "hibernate", cat: "Performance", name: "Disable Hibernation", desc: "Frees disk space used by hiberfil.sys.", apply: "powercfg /hibernate off;", undo: "powercfg /hibernate on;" },
  { id: "ultimate", cat: "Performance", name: "Add Ultimate Performance Plan", desc: "Creates and activates the Ultimate Performance power plan.",
    apply: "$o=powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61;if($o -match '([0-9a-fA-F-]{36})'){powercfg -setactive $Matches[1]};",
    undo: "powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e;" },
  { id: "temp", cat: "Performance", name: "Delete Temporary Files", rec: true, desc: "Clears user/system temp folders and the Recycle Bin.",
    apply: "Remove-Item \"$env:TEMP\\*\",'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue;Clear-RecycleBin -Force -ErrorAction SilentlyContinue;" },

  // --- Updates ---
  { id: "noreboot", cat: "Updates", name: "No Auto-Restart After Updates", rec: true, desc: "Never reboots while you're signed in.",
    apply: set(`${POL}/WindowsUpdate/AU`, "NoAutoRebootWithLoggedOnUsers", 1), undo: del(`${POL}/WindowsUpdate/AU`, "NoAutoRebootWithLoggedOnUsers") },
  { id: "nodrivers", cat: "Updates", name: "Exclude Drivers from Windows Update", desc: "Stops Windows overwriting your GPU/chipset drivers.",
    apply: set(`${POL}/WindowsUpdate`, "ExcludeWUDriversInQualityUpdate", 1), undo: del(`${POL}/WindowsUpdate`, "ExcludeWUDriversInQualityUpdate") },
];

export const PRESETS = {
  recommended: TWEAKS.filter((t) => t.rec).map((t) => t.id),
  privacy: TWEAKS.filter((t) => t.cat === "Privacy").map((t) => t.id),
  debloat: TWEAKS.filter((t) => t.cat === "Debloat" && !t.danger).map((t) => t.id),
};

// ---------- optional Windows features ----------
export const FEATURES = [
  [".NET Framework 3.5", "NetFx3"], ["Hyper-V", "Microsoft-Hyper-V-All"], ["Windows Subsystem for Linux", "Microsoft-Windows-Subsystem-Linux"],
  ["Virtual Machine Platform", "VirtualMachinePlatform"], ["Windows Sandbox", "Containers-DisposableClientVM"],
  ["Telnet Client", "TelnetClient"], ["NFS Client", "ServicesForNFS-ClientOnly"],
].map(([name, id]) => ({
  id, name,
  apply: `Enable-WindowsOptionalFeature -Online -FeatureName ${id} -All -NoRestart`,
  undo: `Disable-WindowsOptionalFeature -Online -FeatureName ${id} -NoRestart`,
}));

// ---------- toggles ----------
const MOUSE = "HKCU:/Control Panel/Mouse";
const STICKY = "HKCU:/Control Panel/Accessibility/StickyKeys";
const KBD = "Registry::HKEY_USERS/.DEFAULT/Control Panel/Keyboard";
export const PREFS = [
  { id: "dark", name: "Dark Theme for Windows",
    on: set(PERS, "AppsUseLightTheme", 0) + set(PERS, "SystemUsesLightTheme", 0),
    off: set(PERS, "AppsUseLightTheme", 1) + set(PERS, "SystemUsesLightTheme", 1) },
  { id: "ext", name: "Show File Extensions", on: set(EXP, "HideFileExt", 0) + restartExplorer, off: set(EXP, "HideFileExt", 1) + restartExplorer },
  { id: "hidden", name: "Show Hidden Files", on: set(EXP, "Hidden", 1) + restartExplorer, off: set(EXP, "Hidden", 2) + restartExplorer },
  { id: "classic", name: "Classic Right-Click Menu (Win 11)",
    on: `New-Item '${CLSID}/InprocServer32' -Force|Out-Null;Set-ItemProperty '${CLSID}/InprocServer32' -Name '(default)' -Value '';` + restartExplorer,
    off: `Remove-Item '${CLSID}' -Recurse -Force -ErrorAction SilentlyContinue;` + restartExplorer },
  { id: "search", name: "Hide Taskbar Search Box",
    on: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Search", "SearchboxTaskbarMode", 0),
    off: set("HKCU:/Software/Microsoft/Windows/CurrentVersion/Search", "SearchboxTaskbarMode", 2) },
  { id: "taskview", name: "Hide Task View Button", on: set(EXP, "ShowTaskViewButton", 0) + restartExplorer, off: set(EXP, "ShowTaskViewButton", 1) + restartExplorer },
  { id: "widgetbtn", name: "Hide Widgets Button", on: set(EXP, "TaskbarDa", 0) + restartExplorer, off: set(EXP, "TaskbarDa", 1) + restartExplorer },
  { id: "left", name: "Left-Align Taskbar (Win 11)", on: set(EXP, "TaskbarAl", 0) + restartExplorer, off: set(EXP, "TaskbarAl", 1) + restartExplorer },
  { id: "thispc", name: "Open Explorer to This PC", on: set(EXP, "LaunchTo", 1) + restartExplorer, off: set(EXP, "LaunchTo", 2) + restartExplorer },
  { id: "mouseaccel", name: "Disable Mouse Acceleration (sign out to apply)",
    on: set(MOUSE, "MouseSpeed", "0", "String") + set(MOUSE, "MouseThreshold1", "0", "String") + set(MOUSE, "MouseThreshold2", "0", "String"),
    off: set(MOUSE, "MouseSpeed", "1", "String") + set(MOUSE, "MouseThreshold1", "6", "String") + set(MOUSE, "MouseThreshold2", "10", "String") },
  { id: "sticky", name: "Disable Sticky Keys Prompt",
    on: set(STICKY, "Flags", "506", "String"), off: set(STICKY, "Flags", "510", "String") },
  { id: "numlock", name: "NumLock on Startup",
    on: set(KBD, "InitialKeyboardIndicators", "2", "String"), off: set(KBD, "InitialKeyboardIndicators", "0", "String") },
];

// ---------- repair ----------
export const FIXES = [
  { name: "Reset Network", desc: "Winsock, IP stack and DNS cache reset (reboot after).", run: "netsh winsock reset;netsh int ip reset;ipconfig /flushdns;" },
  { name: "Reset Windows Update", desc: "Stops services and clears the update cache.",
    run: "Stop-Service wuauserv,bits,cryptsvc -Force;Remove-Item C:/Windows/SoftwareDistribution -Recurse -Force -ErrorAction SilentlyContinue;Start-Service wuauserv,bits,cryptsvc;" },
  { name: "System Corruption Scan", desc: "Runs DISM RestoreHealth then SFC.", run: "DISM /Online /Cleanup-Image /RestoreHealth;sfc /scannow;" },
  { name: "Flush DNS Cache", desc: "Clears the resolver cache.", run: "Clear-DnsClientCache;" },
  { name: "Reset Microsoft Store", desc: "Clears the Store cache.", run: "Start-Process wsreset.exe -Wait;" },
  { name: "Re-register Store Apps", desc: "Repairs broken built-in apps (won't restore ones you deleted; reinstall those from the Store).",
    run: "Get-AppxPackage -AllUsers|ForEach-Object{Add-AppxPackage -DisableDevelopmentMode -Register \"$($_.InstallLocation)\\AppXManifest.xml\" -ErrorAction SilentlyContinue};" },
  { name: "Rebuild Icon Cache", desc: "Fixes blank or wrong icons.",
    run: "Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue;Remove-Item \"$env:LOCALAPPDATA\\IconCache.db\",\"$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer\\iconcache*\" -Force -ErrorAction SilentlyContinue;Start-Process explorer;" },
];

export const PANELS = [
  ["Control Panel", "control"], ["Network Connections", "ncpa.cpl"], ["Sound", "mmsys.cpl"], ["System Properties", "sysdm.cpl"],
  ["Power Options", "powercfg.cpl"], ["Programs and Features", "appwiz.cpl"], ["Services", "services.msc"],
  ["Device Manager", "devmgmt.msc"], ["Disk Management", "diskmgmt.msc"], ["Task Scheduler", "taskschd.msc"],
  ["Startup Apps", "ms-settings:startupapps"], ["Registry Editor", "regedit"],
].map(([name, cmd]) => ({ name, run: `Start-Process '${cmd}'` }));

// ---------- Windows Update modes ----------
const WU = `${POL}/WindowsUpdate`;
export const UPDATES = [
  { name: "Default (Out of Box)", desc: "Removes all update policies; Windows decides.",
    run: `Remove-Item '${WU}' -Recurse -Force -ErrorAction SilentlyContinue;Set-Service wuauserv -StartupType Manual;Start-Service wuauserv -ErrorAction SilentlyContinue;` },
  { name: "Security (Recommended)", desc: "Feature updates deferred 365 days, security updates 4 days.",
    run: `Remove-Item '${WU}/AU' -Recurse -Force -ErrorAction SilentlyContinue;` +
      set(WU, "DeferFeatureUpdates", 1) + set(WU, "DeferFeatureUpdatesPeriodInDays", 365) +
      set(WU, "DeferQualityUpdates", 1) + set(WU, "DeferQualityUpdatesPeriodInDays", 4) +
      "Set-Service wuauserv -StartupType Manual;Start-Service wuauserv -ErrorAction SilentlyContinue;" },
  { name: "Notify Before Downloading", desc: "Windows asks before downloading or installing anything.",
    run: set(`${WU}/AU`, "NoAutoUpdate", 0) + set(`${WU}/AU`, "AUOptions", 2) + "Set-Service wuauserv -StartupType Manual;" },
  { name: "Disable All Updates", desc: "Not recommended: you stop receiving security fixes.", danger: true,
    run: set(`${WU}/AU`, "NoAutoUpdate", 1) + "Stop-Service wuauserv -Force;Set-Service wuauserv -StartupType Disabled;" },
];
