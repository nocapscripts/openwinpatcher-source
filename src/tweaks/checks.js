// Declarative "is it applied?" checks. Pure data: evaluated by status.js in the Electron main process
// with reg.exe / fs / schtasks / powercfg. No PowerShell is involved.
import { BLOAT_PRESETS, TELE_TASKS, ACT_KEYS } from "./tweaks.js";

const R = (key, name, eq) => ({ key, name, eq });
const svcOff = (n) => R(`HKLM\\SYSTEM\\CurrentControlSet\\Services\\${n}`, "Start", 4); // 4 = Disabled

const POL = "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows";
const EXP = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";
const CDM = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager";
const PERS = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
const EDGE = "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge";
const SEARCH = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search";
const CLSID = "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32";

// An array means "all of these must be true".
export const CHECKS = {
  telemetry: [R(`${POL}\\DataCollection`, "AllowTelemetry", 0), svcOff("DiagTrack")],
  teletasks: { tasksDisabled: TELE_TASKS },
  activity: ACT_KEYS.map((n) => R(`${POL}\\System`, n, 0)),
  adid: R("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo", "Enabled", 0),
  location: R("HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location", "Value", "Deny"),
  errorrep: R(`${POL}\\Windows Error Reporting`, "Disabled", 1),
  pwsh: R("HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", "POWERSHELL_TELEMETRY_OPTOUT", "1"),
  consumer: R(`${POL}\\CloudContent`, "DisableWindowsConsumerFeatures", 1),
  ads: ["SilentInstalledAppsEnabled", "SystemPaneSuggestionsEnabled", "SubscribedContent-338388Enabled", "SubscribedContent-338389Enabled"].map((n) => R(CDM, n, 0)),
  bing: R("HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer", "DisableSearchBoxSuggestions", 1),
  widgets: R("HKLM\\SOFTWARE\\Policies\\Microsoft\\Dsh", "AllowNewsAndInterests", 0),
  chat: R(`${POL}\\Windows Chat`, "ChatIcon", 3),
  copilot: R(`${POL}\\WindowsCopilot`, "TurnOffWindowsCopilot", 1),
  recall: R(`${POL}\\WindowsAI`, "DisableAIDataAnalysis", 1),
  edge: [R(EDGE, "StartupBoostEnabled", 0), R(EDGE, "BackgroundModeEnabled", 0)],
  onedrive: { pathsMissing: ["%LOCALAPPDATA%\\Microsoft\\OneDrive\\OneDrive.exe", "%ProgramFiles%\\Microsoft OneDrive\\OneDrive.exe"] },
  debloat: { bloatGone: BLOAT_PRESETS.recommended },
  gamedvr: R("HKCU\\System\\GameConfigStore", "GameDVR_Enabled", 0),
  gamemode: R("HKCU\\Software\\Microsoft\\GameBar", "AutoGameModeEnabled", 1),
  hags: R("HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers", "HwSchMode", 2),
  delivery: R(`${POL}\\DeliveryOptimization`, "DODownloadMode", 0),
  hibernate: R("HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power", "HibernateEnabled", 0),
  ultimate: { powerPlan: "ultimate" },
  noreboot: R(`${POL}\\WindowsUpdate\\AU`, "NoAutoRebootWithLoggedOnUsers", 1),
  nodrivers: R(`${POL}\\WindowsUpdate`, "ExcludeWUDriversInQualityUpdate", 1),
};

export const PREF_CHECKS = {
  dark: R(PERS, "AppsUseLightTheme", 0),
  ext: R(EXP, "HideFileExt", 0),
  hidden: R(EXP, "Hidden", 1),
  classic: { keyExists: CLSID },
  search: R(SEARCH, "SearchboxTaskbarMode", 0),
  taskview: R(EXP, "ShowTaskViewButton", 0),
  widgetbtn: R(EXP, "TaskbarDa", 0),
  left: R(EXP, "TaskbarAl", 0),
  thispc: R(EXP, "LaunchTo", 1),
  mouseaccel: R("HKCU\\Control Panel\\Mouse", "MouseSpeed", "0"),
  sticky: R("HKCU\\Control Panel\\Accessibility\\StickyKeys", "Flags", "506"),
  numlock: R("HKU\\.DEFAULT\\Control Panel\\Keyboard", "InitialKeyboardIndicators", "2"),
};
