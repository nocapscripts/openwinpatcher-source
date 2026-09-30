# OpenWinPatcher (OWP)

A free, open-source Windows utility built with React. Install apps with winget and choco, apply privacy and performance tweaks, change Windows settings, and control Windows Update from one place.

## Security warning

**Only download OpenWinPatcher from this official repository and its Releases page.**

- This tool changes system settings and installs software, so it runs with administrator rights. A tampered copy could do serious damage.

- **Do not fork, copy, repackage or redistribute this project to spread viruses, malware, spyware, ransomware, miners or any other malicious code.** Doing so is unauthorized, is not supported by the author, and may be illegal.

- Modified copies from other websites, videos or file-sharing links are **not** official. Do not run them.

- Before running a build, check that it comes from this repo's Releases page. You can also read the source and build it yourself.

- If you find a fake or malicious copy, please open an issue with the link so it can be reported.

Forks made in good faith, for learning or to contribute back, are welcome as long as they stay honest and do not pretend to be the official app.

## Run

    npm install
    npm run dev

Run your terminal as administrator, or tweaks will fail.

## Build installer (Windows)

    npm run build

The installer asks for administrator rights.

## Pages

- **Install**: winget app installer with search, filters, install, upgrade all, and detection of installed apps.
- **Tweaks**: privacy and performance tweaks, each with an undo. Definitions are in `src/tweaks.js`.
- **Config**: Windows features, preference switches, fixes, and legacy control panels.
- **Updates**: Default, Security (recommended) and Disabled update policies.
- **Report**: send a bug report or feature request. It opens a pre-filled GitHub issue.


## Customizing

- Add apps in `src/tweaks/apps.js` using the format `Name|Winget.Id|f` (`f` = FOSS).
- Verify winget IDs with `winget search <name>`. A few (Helium, TeamSpeak 6, Claude, VS 2026) may need adjusting.
- Add tweaks in `src/tweaks.js` with a name, an `apply` PowerShell string and an `undo` string.

## Use at your own risk

Tweaks edit the registry and Windows services. Create a restore point first (there is a tweak for it) and read what each option does. The software is provided as is, without warranty.

## Issues and feature requests

All issues and requests are welcome, whether it is a bug, a wrong winget ID, a broken tweak, or an idea for a new feature.

1. Open the **Report** page in the app, or go to the repo's **Issues** tab.
2. Choose **Bug** or **Feature request** and describe what happened or what you want.
3. For bugs, include your Windows version and the steps to reproduce.

Pull requests with bug fixes and new features are also welcome. Please keep changes focused and explain what they do.

## License

See the `LICENSE` file.
