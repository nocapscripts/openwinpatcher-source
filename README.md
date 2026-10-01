# OpenWinPatcher (OWP)

A free, open-source Windows utility built with React. Install apps with winget and choco, apply privacy and performance tweaks, change Windows settings, and control Windows Update from one place.

## Download

| | |
|---|---|
| **Latest release** | [Download the installer](../../releases/latest) |
| **All versions and patch notes** | [Releases](../../releases) |
| **Report a problem** | [Open an issue](../../issues/new/choose) |

1. Open the [latest release](../../releases/latest) and download the `.exe` under **Assets**.
2. Run the installer. It asks for administrator rights.
3. Start OWP. A PowerShell window opens with it and shows everything the app runs.

**Requirements:** Windows 10 or 11, [winget](https://learn.microsoft.com/windows/package-manager/) (App Installer), administrator rights, and an internet connection for installs and updates.

## Latest patches and fixes

Full notes for every version are on the [Releases](../../releases) page.

**v1.0.1**
- Failed installs were reported as completed. The app now lists which apps failed and keeps them selected for a retry.
- Fixed two windows opening on start and a startup crash.
- Fixed missing and duplicated PowerShell output. Install, upgrade and script output now streams live.
- Fixed duplicate progress events, and blocked starting a second script while one is running.
- Failed operations now show a red progress panel and a "Failed" status.
- New interface, and a PowerShell output window that opens with the app (reopen it with the **Terminal** button).

## Security warning

**Only download OpenWinPatcher from this official repository and its [Releases](../../releases) page.**

- This tool changes system settings and installs software, so it runs with administrator rights. A tampered copy could do serious damage.

- **Do not fork, copy, repackage or redistribute this project to spread viruses, malware, spyware, ransomware, miners or any other malicious code.** Doing so is unauthorized, is not supported by the author, and may be illegal.

- Modified copies from other websites, videos or file-sharing links are **not** official. Do not run them.

- Before running a build, check that it comes from this repo's Releases page. You can also read the source and build it yourself.

- If you find a fake or malicious copy, please open an issue with the link so it can be reported.

Forks made in good faith, for learning or to contribute back, are welcome as long as they stay honest and do not pretend to be the official app.

## Run from source

    npm install
    npm run dev

Run your terminal as administrator, or tweaks will fail.

## Build installer (Windows)

    npm run build

The installer asks for administrator rights.

## Pages

- **Install**: winget app installer with search, filters, install, upgrade all, and detection of installed apps. Shortcuts: `Ctrl+F` focuses search, `Esc` clears it.
- **Tweaks**: privacy and performance tweaks, each with an undo. Definitions are in `src/tweaks.js`.
- **Config**: Windows features, preference switches, fixes, and legacy control panels.
- **Updates**: Default, Security (recommended) and Disabled update policies.
- **Report**: send a bug report or feature request. It opens a pre-filled GitHub issue.

## PowerShell output

OWP opens a real PowerShell window with the app and prints every command and its result, with errors in red. If you close it, click **Terminal** in the progress panel to open it again. Include its output when you report a bug.

## Troubleshooting

- **"failed (run the app as administrator)"**: close OWP and start it again with *Run as administrator*.
- **`winget` is not recognized**: install or update *App Installer* from the Microsoft Store, then restart OWP.
- **An app fails to install**: read the red lines in the PowerShell window. Failed apps stay selected so you can retry them.

## Customizing

- Add apps in `src/tweaks/apps.js` using the format `Name|Winget.Id|f` (`f` = FOSS).
- Verify winget IDs with `winget search <name>`. A few (Helium, TeamSpeak 6, Claude, VS 2026) may need adjusting.
- Add tweaks in `src/tweaks.js` with a name, an `apply` PowerShell string and an `undo` string.

## Use at your own risk

Tweaks edit the registry and Windows services. Create a restore point first (there is a tweak for it) and read what each option does. The software is provided as is, without warranty.

## Issues and feature requests

All issues and requests are welcome, whether it is a bug, a wrong winget ID, a broken tweak, or an idea for a new feature.

1. Open the **Report** page in the app, or go to the repo's [Issues](../../issues) tab.
2. Choose **Bug** or **Feature request** and describe what happened or what you want.
3. For bugs, include your Windows version, the steps to reproduce, and the PowerShell output.

Pull requests with bug fixes and new features are also welcome. Please keep changes focused and explain what they do.

## License

See the `LICENSE` file.
