// Format per line: Name|Winget.Id|f|chocolatey-id
// f = FOSS (leave empty if not). chocolatey-id is optional; without it the app is WinGet-only.
const raw = {
  Browsers: `Brave|Brave.Brave|f|brave
Chrome|Google.Chrome||googlechrome
Chromium|Hibbiki.Chromium|f|chromium
Edge|Microsoft.Edge||microsoft-edge
Firefox|Mozilla.Firefox|f|firefox
Firefox ESR|Mozilla.Firefox.ESR|f|firefoxesr
Floorp|Ablaze.Floorp|f|floorp
Helium|ImputNet.Helium|f
LibreWolf|LibreWolf.LibreWolf|f|librewolf
Mullvad Browser|MullvadVPN.MullvadBrowser|f|mullvad-browser
Tor Browser|TorProject.TorBrowser|f|tor-browser
Ungoogled Chromium|eloston.ungoogled-chromium|f|ungoogled-chromium
Vivaldi|Vivaldi.Vivaldi||vivaldi
Waterfox|Waterfox.Waterfox|f|waterfox
Zen Browser|Zen-Team.Zen-Browser|f`,
  Communications: `Betterbird|Betterbird.Betterbird|f
Chatterino|ChatterinoTeam.Chatterino|f|chatterino
Discord|Discord.Discord||discord
Dorion|SpikeHD.Dorion|f
Element|Element.Element|f|element-desktop
Proton Mail|Proton.ProtonMail|f|protonmail
QTox|Tox.qTox|f|qtox
Signal|OpenWhisperSystems.Signal|f|signal
Slack|SlackTechnologies.Slack||slack
Teams|Microsoft.Teams||microsoft-teams
TeamSpeak 3|TeamSpeakSystems.TeamSpeakClient||teamspeak
TeamSpeak 6|TeamSpeakSystems.TeamSpeak6Client
Telegram|Telegram.TelegramDesktop|f|telegram
Thunderbird|Mozilla.Thunderbird|f|thunderbird
Vesktop|Vencord.Vesktop|f|vesktop
Viber|Viber.Viber||viber
WhatsApp Desktop|WhatsApp.WhatsApp||whatsapp
Zoom|Zoom.Zoom||zoom`,
  Development: `Amazon Corretto 21 (LTS)|Amazon.Corretto.21.JDK|f|corretto21jdk
Amazon Corretto 25 (LTS)|Amazon.Corretto.25.JDK|f
Amazon Corretto 8 (LTS)|Amazon.Corretto.8.JDK|f|corretto8jdk
Bruno|Bruno.Bruno|f|bruno
ChatGPT Desktop|OpenAI.ChatGPT
Claude Code|Anthropic.ClaudeCode
Claude Desktop|Anthropic.Claude
CMake|Kitware.CMake|f|cmake
Codex|OpenAI.Codex
Cursor|Anysphere.Cursor
Docker Desktop|Docker.DockerDesktop||docker-desktop
Fast Node Manager|Schniz.fnm|f|fnm
Git|Git.Git|f|git
Git Extensions|GitExtensionsTeam.GitExtensions|f|gitextensions
GitHub CLI|GitHub.cli|f|gh
GitHub Desktop|GitHub.GitHubDesktop|f|github-desktop
Go|GoLang.Go|f|golang
Jetbrains Toolbox|JetBrains.Toolbox||jetbrainstoolbox
Lazygit|JesseDuffield.lazygit|f|lazygit
Lua|DEVCOM.Lua|f|lua
Neovim|Neovim.Neovim|f|neovim
NodeJS|OpenJS.NodeJS|f|nodejs
NodeJS LTS|OpenJS.NodeJS.LTS|f|nodejs-lts
Oh My Posh (Prompt)|JanDeDobbeleer.OhMyPosh|f|oh-my-posh
pnpm|pnpm.pnpm|f|pnpm
Postman|Postman.Postman||postman
Python3|Python.Python.3.12|f|python312
Ruby|RubyInstallerTeam.Ruby.3.4|f|ruby
Rust|Rustlang.Rustup|f|rustup.install
Starship (Shell Prompt)|Starship.Starship|f|starship
Sublime Text|SublimeHQ.SublimeText.4||sublimetext4
System Informer|WinsiderSS.SystemInformer|f
Unity Game Engine|Unity.UnityHub||unityhub
uv|astral-sh.uv|f|uv
Vagrant|Hashicorp.Vagrant|f|vagrant
Visual Studio 2022|Microsoft.VisualStudio.2022.Community||visualstudio2022community
Visual Studio 2026|Microsoft.VisualStudio.Community
VS Code|Microsoft.VisualStudioCode|f|vscode
VS Codium|VSCodium.VSCodium|f|vscodium
Yarn|Yarn.Yarn|f|yarn
Zed|Zed.Zed|f`,
  Document: `Adobe Acrobat Reader|Adobe.Acrobat.Reader.64-bit||adobereader
Foxit PDF Reader|Foxit.FoxitReader||foxitreader
Joplin|Joplin.Joplin|f|joplin
LibreOffice|TheDocumentFoundation.LibreOffice|f|libreoffice-fresh
NAPS2 (Scanner)|Cyanfish.NAPS2|f|naps2
Obsidian|Obsidian.Obsidian|f|obsidian
Okular|KDE.Okular|f|okular
ONLYOFFICE Desktop|ONLYOFFICE.DesktopEditors|f|onlyoffice
PDF-XChange Editor|TrackerSoftware.PDF-XChangeEditor||pdfxchangeeditor
PDF24 Creator|geeksoftwareGmbH.PDF24Creator||pdf24
PDFgear|PDFgear.PDFgear
PDFsam Basic|PDFsam.PDFsam|f|pdfsam
QOwnNotes|pbek.QOwnNotes|f|qownnotes
Simplenote|Automattic.Simplenote|f|simplenote
Sumatra PDF|SumatraPDF.SumatraPDF|f|sumatrapdf
Xournal++|Xournal++.Xournal++|f|xournalplusplus`,
};

export const CATEGORIES = Object.keys(raw);
export const APPS = CATEGORIES.flatMap((category) =>
  raw[category].split("\n").map((line) => {
    const [name, id, f, choco] = line.split("|");
    return { name, id, category, foss: f === "f", choco: choco || null };
  })
);
