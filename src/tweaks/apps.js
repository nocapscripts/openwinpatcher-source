// Format per line: Name|Winget.Id|f   (f = FOSS)
const raw = {
  Browsers: `Brave|Brave.Brave|f
Chrome|Google.Chrome
Chromium|Hibbiki.Chromium|f
Edge|Microsoft.Edge
Firefox|Mozilla.Firefox|f
Firefox ESR|Mozilla.Firefox.ESR|f
Floorp|Ablaze.Floorp|f
Helium|ImputNet.Helium|f
LibreWolf|LibreWolf.LibreWolf|f
Mullvad Browser|MullvadVPN.MullvadBrowser|f
Tor Browser|TorProject.TorBrowser|f
Ungoogled Chromium|eloston.ungoogled-chromium|f
Vivaldi|Vivaldi.Vivaldi
Waterfox|Waterfox.Waterfox|f
Zen Browser|Zen-Team.Zen-Browser|f`,
  Communications: `Betterbird|Betterbird.Betterbird|f
Chatterino|ChatterinoTeam.Chatterino|f
Discord|Discord.Discord
Dorion|SpikeHD.Dorion|f
Element|Element.Element|f
Proton Mail|Proton.ProtonMail|f
QTox|Tox.qTox|f
Signal|OpenWhisperSystems.Signal|f
Slack|SlackTechnologies.Slack
Teams|Microsoft.Teams
TeamSpeak 3|TeamSpeakSystems.TeamSpeakClient
TeamSpeak 6|TeamSpeakSystems.TeamSpeak6Client
Telegram|Telegram.TelegramDesktop|f
Thunderbird|Mozilla.Thunderbird|f
Vesktop|Vencord.Vesktop|f
Viber|Viber.Viber
WhatsApp Desktop|WhatsApp.WhatsApp
Zoom|Zoom.Zoom`,
  Development: `Amazon Corretto 21 (LTS)|Amazon.Corretto.21.JDK|f
Amazon Corretto 25 (LTS)|Amazon.Corretto.25.JDK|f
Amazon Corretto 8 (LTS)|Amazon.Corretto.8.JDK|f
Bruno|Bruno.Bruno|f
ChatGPT Desktop|OpenAI.ChatGPT
Claude Code|Anthropic.ClaudeCode
Claude Desktop|Anthropic.Claude
CMake|Kitware.CMake|f
Codex|OpenAI.Codex
Cursor|Anysphere.Cursor
Docker Desktop|Docker.DockerDesktop
Fast Node Manager|Schniz.fnm|f
Git|Git.Git|f
Git Extensions|GitExtensionsTeam.GitExtensions|f
GitHub CLI|GitHub.cli|f
GitHub Desktop|GitHub.GitHubDesktop|f
Go|GoLang.Go|f
Jetbrains Toolbox|JetBrains.Toolbox
Lazygit|JesseDuffield.lazygit|f
Lua|DEVCOM.Lua|f
Neovim|Neovim.Neovim|f
NodeJS|OpenJS.NodeJS|f
NodeJS LTS|OpenJS.NodeJS.LTS|f
Oh My Posh (Prompt)|JanDeDobbeleer.OhMyPosh|f
pnpm|pnpm.pnpm|f
Postman|Postman.Postman
Python3|Python.Python.3.12|f
Ruby|RubyInstallerTeam.Ruby.3.4|f
Rust|Rustlang.Rustup|f
Starship (Shell Prompt)|Starship.Starship|f
Sublime Text|SublimeHQ.SublimeText.4
System Informer|WinsiderSS.SystemInformer|f
Unity Game Engine|Unity.UnityHub
uv|astral-sh.uv|f
Vagrant|Hashicorp.Vagrant|f
Visual Studio 2022|Microsoft.VisualStudio.2022.Community
Visual Studio 2026|Microsoft.VisualStudio.Community
VS Code|Microsoft.VisualStudioCode|f
VS Codium|VSCodium.VSCodium|f
Yarn|Yarn.Yarn|f
Zed|Zed.Zed|f`,
  Document: `Adobe Acrobat Reader|Adobe.Acrobat.Reader.64-bit
Foxit PDF Reader|Foxit.FoxitReader
Joplin|Joplin.Joplin|f
LibreOffice|TheDocumentFoundation.LibreOffice|f
NAPS2 (Scanner)|Cyanfish.NAPS2|f
Obsidian|Obsidian.Obsidian|f
Okular|KDE.Okular|f
ONLYOFFICE Desktop|ONLYOFFICE.DesktopEditors|f
PDF-XChange Editor|TrackerSoftware.PDF-XChangeEditor
PDF24 Creator|geeksoftwareGmbH.PDF24Creator
PDFgear|PDFgear.PDFgear
PDFsam Basic|PDFsam.PDFsam|f
QOwnNotes|pbek.QOwnNotes|f
Simplenote|Automattic.Simplenote|f
Sumatra PDF|SumatraPDF.SumatraPDF|f
Xournal++|Xournal++.Xournal++|f`,
};

export const CATEGORIES = Object.keys(raw);
export const APPS = CATEGORIES.flatMap((category) =>
  raw[category].split("\n").map((line) => {
    const [name, id, f] = line.split("|");
    return { name, id, category, foss: f === "f" };
  })
);
