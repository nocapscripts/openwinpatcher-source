import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, X } from "lucide-react";

import { APPS, CATEGORIES } from "./tweaks/apps.js";
import Report from "./Report.jsx";
import { Tweaks, Config, Updates } from "./Pages.jsx";

import {
  AppTile,
  ProgressPanel,
  TweaksProgress,
  Rail,
  TitleBar,
} from "./components/Shell.jsx";

import {
  Btn,
  H1,
  H2,
  Main,
  Scroll,
  Select,
  Toolbar,
} from "./components/ui.jsx";

/* =========================================================
 * API
 * ========================================================= */

const api = window.api ?? {
  min() {},
  max() {},
  close() {},

  onProgress() {
    return undefined;
  },

  ps: async () => ({
    code: 0,
  }),

  install: async () => [],

  upgradeAll: async () => true,

  installed: async () => [],

  chocoCheck: async () => false,

  pmStatus: async () => ({
    winget: false,
    choco: false,
  }),
};

/* =========================================================
 * PACKAGE MANAGERS
 * ========================================================= */

const MANAGERS = {
  "Auto (Recommended)": "auto",
  WinGet: "winget",
  Chocolatey: "choco",
};

/* =========================================================
 * APP DATA
 * ========================================================= */

const APP_REFS = APPS.map(({ id, choco }) => ({
  id,
  choco,
}));

const BY_ID = Object.fromEntries(
  APPS.map((app) => [app.id, app])
);

/* =========================================================
 * PROGRESS CHANNELS
 *
 * "apps"   -> Apps tab (installs, upgrades, package managers)
 * "tweaks" -> Tweaks / Config / Updates tabs (runPs)
 * ========================================================= */

const IDLE = {
  running: false,
  error: false,
  label: "Ready",
  progress: 0,
  status: "",
};

/* =========================================================
 * POWERSHELL SCRIPTS
 *
 * IMPORTANT:
 *
 * Do NOT use PowerShell backticks inside JavaScript
 * template literals.
 *
 * Keep PowerShell commands on one line instead.
 * ========================================================= */

/* ---------------------------------------------------------
 * WINGET
 * --------------------------------------------------------- */

const WINGET_CHECK_SCRIPT = `
$ErrorActionPreference = "SilentlyContinue"

$winget = Get-Command winget.exe -ErrorAction SilentlyContinue

if (-not $winget) {
    Write-Output "WinGet is not installed."
    exit 1
}

$version = & $winget.Source --version 2>$null

if ($LASTEXITCODE -ne 0 -or -not $version) {
    Write-Output "WinGet was found but could not be executed."
    exit 1
}

Write-Output "WinGet version: $version"
exit 0
`.trim();

/* ---------------------------------------------------------
 * CHOCOLATEY CHECK
 * --------------------------------------------------------- */

const CHOCO_CHECK_SCRIPT = `
$ErrorActionPreference = "SilentlyContinue"

$choco = Get-Command choco.exe -ErrorAction SilentlyContinue

if (-not $choco) {
    exit 1
}

$version = & $choco.Source --version 2>$null

if ($LASTEXITCODE -ne 0 -or -not $version) {
    exit 1
}

Write-Output "Chocolatey version: $version"
exit 0
`.trim();

/* ---------------------------------------------------------
 * CHOCOLATEY INSTALL
 * --------------------------------------------------------- */

const CHOCO_INSTALL_SCRIPT = `
$ErrorActionPreference = "Stop"

Set-ExecutionPolicy Bypass -Scope Process -Force

[System.Net.ServicePointManager]::SecurityProtocol =
    [System.Net.ServicePointManager]::SecurityProtocol -bor 3072

Write-Output "Installing Chocolatey..."

iex ((New-Object System.Net.WebClient).DownloadString(
    "https://community.chocolatey.org/install.ps1"
))

if (-not (Get-Command choco.exe -ErrorAction SilentlyContinue)) {
    throw "Chocolatey installation completed but choco.exe was not found."
}

Write-Output "Chocolatey installation completed."
`.trim();

/* ---------------------------------------------------------
 * CHOCOLATEY REMOVE
 * --------------------------------------------------------- */

const CHOCO_REMOVE_SCRIPT = `
$ErrorActionPreference = "SilentlyContinue"

Write-Output "Removing Chocolatey..."

$choco = Get-Command choco.exe -ErrorAction SilentlyContinue

if ($choco) {
    & $choco.Source uninstall chocolatey -y
}

Write-Output "Chocolatey package removal completed."
exit 0
`.trim();

/* ---------------------------------------------------------
 * CHOCOLATEY CLEAN
 * --------------------------------------------------------- */

const CHOCO_CLEAN_SCRIPT = `
$ErrorActionPreference = "SilentlyContinue"

Write-Output "Cleaning Chocolatey installation..."

$paths = @(
    "$env:ChocolateyInstall",
    "$env:ProgramData\\chocolatey"
)

foreach ($path in $paths) {
    if ($path -and (Test-Path -LiteralPath $path)) {
        Write-Output "Removing: $path"

        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

[Environment]::SetEnvironmentVariable(
    "ChocolateyInstall",
    $null,
    "Machine"
)

[Environment]::SetEnvironmentVariable(
    "ChocolateyInstall",
    $null,
    "User"
)

Write-Output "Chocolatey cleanup completed."
`.trim();

/* =========================================================
 * HELPERS
 * ========================================================= */

const clamp = (value) =>
  Math.min(100, Math.max(0, Number(value) || 0));

const errorMessage = (error) =>
  error?.message || String(error);

const successfulPsResult = (result) => {
  if (result === true) {
    return true;
  }

  if (!result || typeof result !== "object") {
    return false;
  }

  return Number(result.code) === 0;
};

/* =========================================================
 * APP
 * ========================================================= */

export default function App() {
  /* =======================================================
   * FILTER STATE
   * ======================================================= */

  const [query, setQuery] = useState("");

  const [category, setCategory] =
    useState("All categories");

  const [manager, setManager] =
    useState("Auto (Recommended)");

  const [audience, setAudience] =
    useState("Everyone");

  /* =======================================================
   * APPLICATION STATE
   * ======================================================= */

  const [selected, setSelected] =
    useState(new Set());

  const [installed, setInstalled] =
    useState(new Set());

  /* =======================================================
   * PACKAGE MANAGER STATE
   * ======================================================= */

  const [pm, setPm] = useState({
    winget: false,
    choco: false,
  });

  /* =======================================================
   * SYSTEM STATE
   * ======================================================= */

  const [sys, setSys] = useState(null);

  /* =======================================================
   * UI STATE
   * ======================================================= */

  const [tab, setTab] =
    useState("install");

  const searchRef =
    useRef(null);

  /*
   * This is the actual operation lock.
   *
   * React state can be stale inside async callbacks,
   * so this ref is the authoritative source.
   *
   * It is shared by both progress channels, so an
   * install and a tweak can never run at the same time.
   */
  const operationRef =
    useRef(false);

  /* =======================================================
   * PROGRESS STATE (separate channel per tab)
   *
   * The setters below write to whichever channel owns the
   * current operation (scopeRef), so existing
   * setProgress / setStatus / ... calls keep working.
   * ======================================================= */

  const [prog, setProg] = useState({
    apps: IDLE,
    tweaks: IDLE,
  });

  const scopeRef =
    useRef("apps");

  const patch = useCallback(
    (changes) => {
      const scope =
        scopeRef.current;

      setProg((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          ...changes,
        },
      }));
    },
    []
  );

  const setProgress = useCallback(
    (progress) => patch({ progress }),
    [patch]
  );

  const setProgressLabel = useCallback(
    (label) => patch({ label }),
    [patch]
  );

  const setStatus = useCallback(
    (status) => patch({ status }),
    [patch]
  );

  const setHasError = useCallback(
    (error) => patch({ error }),
    [patch]
  );

  const setIsRunning = useCallback(
    (running) => patch({ running }),
    [patch]
  );

  const appsProg = prog.apps;
  const tweaksProg = prog.tweaks;

  /*
   * Global lock flag, used to disable buttons on every tab.
   */
  const isRunning =
    appsProg.running ||
    tweaksProg.running;

  /* =======================================================
   * PACKAGE MANAGER MODE
   * ======================================================= */

  const mode =
    MANAGERS[manager] ?? "auto";

  /* =======================================================
   * APP AVAILABILITY
   * ======================================================= */

  const available = useCallback(
    (app) => {
      /*
       * Chocolatey-only filtering.
       *
       * WinGet and Auto allow all apps here because the
       * backend decides which package manager can actually
       * install a package.
       */
      if (mode === "choco") {
        return Boolean(app.choco);
      }

      return true;
    },
    [mode]
  );

  /* =======================================================
   * LOGGING
   * ======================================================= */

  const appendLog = useCallback(
    (...lines) => {
      api.termAppend?.(lines);
    },
    []
  );

  const clearLog = useCallback(() => {
    api.termClear?.();
  }, []);

  const logError = useCallback(
    (message) => {
      appendLog(
        "",
        `[ERROR] ${message}`,
        ""
      );
    },
    [appendLog]
  );

  /* =======================================================
   * OPERATION CONTROLLER
   *
   * Every long-running action must use these functions.
   * ======================================================= */

  const startOperation = useCallback(
    (label, logLines = [], scope = "apps") => {
      if (operationRef.current) {
        return false;
      }

      operationRef.current = true;
      scopeRef.current = scope;

      setIsRunning(true);
      setHasError(false);
      setProgress(0);
      setProgressLabel(label);
      setStatus(`${label}...`);

      clearLog();

      appendLog(
        `PS> ${label}`,
        ...logLines,
        ""
      );

      return true;
    },
    [
      appendLog,
      clearLog,
      setHasError,
      setIsRunning,
      setProgress,
      setProgressLabel,
      setStatus,
    ]
  );

  const finishOperation = useCallback(
    ({
      label,
      status: finalStatus,
      progress: finalProgress = 100,
    }) => {
      setProgress(
        clamp(finalProgress)
      );

      setProgressLabel(label);

      if (finalStatus) {
        setStatus(finalStatus);
      }

      operationRef.current = false;
      setIsRunning(false);
    },
    [
      setIsRunning,
      setProgress,
      setProgressLabel,
      setStatus,
    ]
  );

  const failOperation = useCallback(
    (label, error) => {
      const message =
        errorMessage(error);

      setHasError(true);
      setProgressLabel(label);
      setStatus(
        `${label}: ${message}`
      );

      logError(message);

      operationRef.current = false;
      setIsRunning(false);

      return {
        code: 1,
        error: message,
      };
    },
    [
      logError,
      setHasError,
      setIsRunning,
      setProgressLabel,
      setStatus,
    ]
  );

  /* =======================================================
   * POWERSHELL EXECUTOR
   *
   * This function NEVER modifies operation state.
   * ======================================================= */

  const executePs = useCallback(
    async (script, label) => {
      appendLog(`PS> ${label}`);

      try {
        const result =
          await api.ps(script);

        if (
          !successfulPsResult(result)
        ) {
          const message =
            result?.error ||
            `${label} failed with exit code ${
              result?.code ?? "unknown"
            }`;

          appendLog(
            `[ERROR] ${message}`
          );

          throw new Error(message);
        }

        appendLog(
          `PS> ${label}: OK`
        );

        return result;
      } catch (error) {
        appendLog(
          `[ERROR] ${label}: ${errorMessage(
            error
          )}`
        );

        throw error;
      }
    },
    [appendLog]
  );

  /* =======================================================
   * WINGET CHECK
   *
   * This is a helper only.
   *
   * It returns true/false and does not own the operation
   * lifecycle.
   * ======================================================= */

  const checkWinget =
    useCallback(async () => {
      try {
        appendLog(
          "PS> Checking WinGet..."
        );

        const result =
          await api.ps(
            WINGET_CHECK_SCRIPT
          );

        const available =
          successfulPsResult(result);

        setPm((current) => ({
          ...current,
          winget: available,
        }));

        if (available) {
          appendLog(
            "PS> WinGet is available.",
            ""
          );
        } else {
          appendLog(
            "PS> WinGet is not available.",
            ""
          );
        }

        return available;
      } catch (error) {
        setPm((current) => ({
          ...current,
          winget: false,
        }));

        appendLog(
          `[WARN] WinGet check failed: ${errorMessage(
            error
          )}`
        );

        return false;
      }
    }, [appendLog]);

  /* =======================================================
   * CHOCOLATEY CHECK
   * ======================================================= */

  const checkChocolatey =
    useCallback(async () => {
      /*
       * Use the backend check if available.
       */
      if (api.chocoCheck) {
        try {
          const result =
            await api.chocoCheck();

          const available =
            Boolean(result);

          setPm((current) => ({
            ...current,
            choco: available,
          }));

          return available;
        } catch {
          /*
           * Fall through to PowerShell.
           */
        }
      }

      try {
        const result =
          await api.ps(
            CHOCO_CHECK_SCRIPT
          );

        const available =
          successfulPsResult(result);

        setPm((current) => ({
          ...current,
          choco: available,
        }));

        return available;
      } catch {
        setPm((current) => ({
          ...current,
          choco: false,
        }));

        return false;
      }
    }, []);

  /* =======================================================
   * REFRESH PACKAGE MANAGERS
   * ======================================================= */

  const refreshPm = useCallback(
    async () => {
      /*
       * Try the backend status first.
       */
      try {
        const result =
          await api.pmStatus();

        if (
          result &&
          typeof result === "object"
        ) {
          setPm({
            winget: Boolean(
              result.winget
            ),
            choco: Boolean(
              result.choco
            ),
          });

          return result;
        }
      } catch {
        /*
         * Fall through to direct checks.
         */
      }

      /*
       * Direct detection fallback.
       */
      const [winget, choco] =
        await Promise.all([
          checkWinget(),
          checkChocolatey(),
        ]);

      const result = {
        winget,
        choco,
      };

      setPm(result);

      return result;
    },
    [
      checkChocolatey,
      checkWinget,
    ]
  );

  /* =======================================================
   * INSTALLED APPLICATIONS
   *
   * This is completely separate from package manager
   * detection.
   * ======================================================= */

  const refreshInstalled =
    useCallback(async () => {
      try {
        const result =
          await api.installed(
            APP_REFS
          );

        const ids =
          Array.isArray(result)
            ? result
            : [];

        setInstalled(
          new Set(ids)
        );

        return ids;
      } catch (error) {
        appendLog(
          `[WARN] Failed to refresh installed apps: ${errorMessage(
            error
          )}`
        );

        return [];
      }
    }, [appendLog]);

  /* =======================================================
   * INITIAL SYSTEM LOAD
   * ======================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const result =
          await window.api?.sysInfo?.();

        if (
          mounted &&
          result
        ) {
          setSys(result);
        }
      } catch {
        /*
         * System information is optional.
         */
      }

      await refreshPm();
      await refreshInstalled();
    };

    load();

    return () => {
      mounted = false;
    };
  }, [
    refreshInstalled,
    refreshPm,
  ]);

  /* =======================================================
   * PROGRESS EVENTS
   *
   * These ONLY update UI (on the channel that owns the
   * current operation).
   *
   * They NEVER finish operations.
   * ======================================================= */

  useEffect(() => {
    if (!api.onProgress) {
      return undefined;
    }

    const cleanup =
      api.onProgress((event) => {
        if (
          typeof event === "string"
        ) {
          setStatus(event);
          return;
        }

        if (!event) {
          return;
        }

        if (
          event.status !== undefined
        ) {
          setStatus(
            event.status
          );
        }

        if (
          event.label !== undefined
        ) {
          setProgressLabel(
            event.label
          );
        }

        if (
          typeof event.progress ===
          "number"
        ) {
          setProgress(
            clamp(event.progress)
          );
        }
      });

    return typeof cleanup ===
      "function"
      ? cleanup
      : undefined;
  }, [
    setProgress,
    setProgressLabel,
    setStatus,
  ]);

  /* =======================================================
   * GENERIC POWERSHELL ACTION
   *
   * Used by Tweaks / Config / Updates.
   * Reports into the "tweaks" progress channel.
   * ======================================================= */

  const runPs = useCallback(
    async (script, label) => {
      if (
        !startOperation(
          label,
          [],
          "tweaks"
        )
      ) {
        return {
          code: 1,
          error:
            "Another operation is running.",
        };
      }

      try {
        const result =
          await executePs(
            script,
            label
          );

        finishOperation({
          label,
          status: `${label}: done`,
        });

        return result;
      } catch (error) {
        return failOperation(
          label,
          error
        );
      }
    },
    [
      executePs,
      failOperation,
      finishOperation,
      startOperation,
    ]
  );

  /* =======================================================
   * INSTALL CHOCOLATEY
   * ======================================================= */

  const installChocolatey =
    useCallback(async () => {
      if (
        !startOperation(
          "Installing Chocolatey",
          [
            "PS> Starting Chocolatey installation...",
          ]
        )
      ) {
        return false;
      }

      try {
        setProgress(10);

        setProgressLabel(
          "Installing Chocolatey"
        );

        setStatus(
          "Installing Chocolatey..."
        );

        await executePs(
          CHOCO_INSTALL_SCRIPT,
          "Install Chocolatey"
        );

        setProgress(75);

        setProgressLabel(
          "Verifying Chocolatey"
        );

        setStatus(
          "Verifying Chocolatey..."
        );

        const verified =
          await checkChocolatey();

        if (!verified) {
          throw new Error(
            "Chocolatey was installed but could not be verified."
          );
        }

        setPm((current) => ({
          ...current,
          choco: true,
        }));

        await refreshPm();

        finishOperation({
          label:
            "Chocolatey installed",
          status:
            "Chocolatey installed successfully.",
        });

        appendLog(
          "",
          "PS> Chocolatey installation successful.",
          ""
        );

        return true;
      } catch (error) {
        failOperation(
          "Chocolatey installation failed",
          error
        );

        return false;
      }
    }, [
      appendLog,
      checkChocolatey,
      executePs,
      failOperation,
      finishOperation,
      refreshPm,
      setProgress,
      setProgressLabel,
      setStatus,
      startOperation,
    ]);

  /* =======================================================
   * REMOVE CHOCOLATEY INTERNAL
   *
   * Does not own operation lifecycle.
   * ======================================================= */

  const removeChocolateyInternal =
    useCallback(async () => {
      setProgress(20);

      setProgressLabel(
        "Removing Chocolatey"
      );

      setStatus(
        "Removing Chocolatey..."
      );

      appendLog(
        "PS> Chocolatey detected.",
        "PS> Removing existing installation..."
      );

      await executePs(
        CHOCO_REMOVE_SCRIPT,
        "Remove Chocolatey"
      );

      setProgress(45);

      setProgressLabel(
        "Cleaning Chocolatey"
      );

      setStatus(
        "Cleaning Chocolatey files..."
      );

      await executePs(
        CHOCO_CLEAN_SCRIPT,
        "Clean Chocolatey"
      );

      setPm((current) => ({
        ...current,
        choco: false,
      }));

      appendLog(
        "PS> Chocolatey removed.",
        "PS> Chocolatey files cleaned.",
        ""
      );
    }, [
      appendLog,
      executePs,
      setProgress,
      setProgressLabel,
      setStatus,
    ]);

  /* =======================================================
   * REMOVE CHOCOLATEY
   * ======================================================= */

  const removeChocolatey =
    useCallback(async () => {
      if (
        !startOperation(
          "Removing Chocolatey",
          [
            "PS> Starting Chocolatey removal...",
          ]
        )
      ) {
        return false;
      }

      try {
        await removeChocolateyInternal();

        await refreshPm();

        finishOperation({
          label:
            "Chocolatey removed",
          status:
            "Chocolatey removed successfully.",
        });

        return true;
      } catch (error) {
        failOperation(
          "Chocolatey removal failed",
          error
        );

        return false;
      }
    }, [
      failOperation,
      finishOperation,
      refreshPm,
      removeChocolateyInternal,
      startOperation,
    ]);

  /* =======================================================
   * REINSTALL CHOCOLATEY
   * ======================================================= */

  const reinstallChocolatey =
    useCallback(async () => {
      if (
        !startOperation(
          "Reinstalling Chocolatey",
          [
            "PS> Starting Chocolatey reinstall...",
            "",
          ]
        )
      ) {
        return false;
      }

      try {
        /* -------------------------------------------------
         * CHECK
         * ------------------------------------------------- */

        setProgress(5);

        setProgressLabel(
          "Checking Chocolatey"
        );

        setStatus(
          "Checking Chocolatey installation..."
        );

        const currentlyInstalled =
          await checkChocolatey();

        /* -------------------------------------------------
         * REMOVE
         * ------------------------------------------------- */

        if (
          currentlyInstalled
        ) {
          await removeChocolateyInternal();
        } else {
          appendLog(
            "PS> Chocolatey is not installed.",
            "PS> Skipping removal.",
            ""
          );
        }

        /* -------------------------------------------------
         * INSTALL
         * ------------------------------------------------- */

        setProgress(55);

        setProgressLabel(
          "Installing Chocolatey"
        );

        setStatus(
          "Installing Chocolatey..."
        );

        await executePs(
          CHOCO_INSTALL_SCRIPT,
          "Install Chocolatey"
        );

        /* -------------------------------------------------
         * VERIFY
         * ------------------------------------------------- */

        setProgress(85);

        setProgressLabel(
          "Verifying Chocolatey"
        );

        setStatus(
          "Verifying Chocolatey..."
        );

        const verified =
          await checkChocolatey();

        if (!verified) {
          throw new Error(
            "Chocolatey installation completed but verification failed."
          );
        }

        /* -------------------------------------------------
         * REFRESH
         * ------------------------------------------------- */

        setPm((current) => ({
          ...current,
          choco: true,
        }));

        await refreshPm();

        /* -------------------------------------------------
         * COMPLETE
         * ------------------------------------------------- */

        finishOperation({
          label:
            "Chocolatey reinstall complete",
          status:
            "Chocolatey reinstalled successfully.",
        });

        appendLog(
          "PS> Chocolatey verified successfully.",
          "PS> Reinstall completed.",
          ""
        );

        return true;
      } catch (error) {
        failOperation(
          "Chocolatey reinstall failed",
          error
        );

        return false;
      }
    }, [
      appendLog,
      checkChocolatey,
      executePs,
      failOperation,
      finishOperation,
      refreshPm,
      removeChocolateyInternal,
      setProgress,
      setProgressLabel,
      setStatus,
      startOperation,
    ]);

  /* =======================================================
   * CHECK WINGET UI ACTION
   * ======================================================= */

  const checkWingetStatus =
    useCallback(async () => {
      if (
        !startOperation(
          "Checking WinGet",
          [
            "PS> Checking WinGet installation...",
          ]
        )
      ) {
        return false;
      }

      try {
        const available =
          await checkWinget();

        if (!available) {
          throw new Error(
            "WinGet is not installed or could not be executed."
          );
        }

        finishOperation({
          label:
            "WinGet available",
          status:
            "WinGet is installed and available.",
        });

        return true;
      } catch (error) {
        failOperation(
          "WinGet check failed",
          error
        );

        return false;
      }
    }, [
      checkWinget,
      failOperation,
      finishOperation,
      startOperation,
    ]);

  const reinstallWinget =
    useCallback(async () => {
      if (
        !startOperation(
          "Reinstalling WinGet",
          [
            "PS> Reinstalling WinGet...",
          ]
        )
      ) {
        return;
      }

      try {
        await executePs(
          "winget install --force --source winget --id Microsoft.WindowsTerminal",
          "Reinstalling WinGet"
        );

        finishOperation({
          label:
            "WinGet reinstalled",
          status:
            "WinGet reinstalled successfully.",
        });
      } catch (error) {
        failOperation(
          "Failed to reinstall WinGet",
          error
        );
      }
    }, [
      executePs,
      failOperation,
      finishOperation,
      startOperation,
    ]);

  /* =======================================================
   * CHECK INSTALLED APPS
   * ======================================================= */

  const getInstalled =
    useCallback(async () => {
      if (
        !startOperation(
          "Checking installed apps",
          [
            "PS> Checking installed applications...",
          ]
        )
      ) {
        return;
      }

      try {
        const result =
          await refreshInstalled();

        finishOperation({
          label:
            "Installed apps checked",
          status:
            `Found ${result.length} installed package${
              result.length === 1
                ? ""
                : "s"
            }.`,
        });
      } catch (error) {
        failOperation(
          "Failed to check installed apps",
          error
        );
      }
    }, [
      failOperation,
      finishOperation,
      refreshInstalled,
      startOperation,
    ]);

  /* =======================================================
   * INSTALL SELECTED
   * ======================================================= */

  const installSelected =
    useCallback(async () => {
      if (
        operationRef.current
      ) {
        return;
      }

      /*
       * Validation errors below must land on the Apps channel.
       */
      scopeRef.current = "apps";

      const apps =
        APPS.filter(
          (app) =>
            selected.has(app.id) &&
            available(app)
        );

      if (!apps.length) {
        setHasError(true);
        setProgressLabel(
          "Nothing to install"
        );
        setStatus(
          "No compatible applications are selected."
        );
        return;
      }

      /* -------------------------------------------------
       * CHOCOLATEY VALIDATION
       * ------------------------------------------------- */

      if (
        mode === "choco"
      ) {
        const available =
          await checkChocolatey();

        if (!available) {
          setHasError(true);
          setProgressLabel(
            "Chocolatey required"
          );
          setStatus(
            "Chocolatey is not installed."
          );
          return;
        }
      }

      /* -------------------------------------------------
       * WINGET VALIDATION
       * ------------------------------------------------- */

      if (
        mode === "winget"
      ) {
        const available =
          await checkWinget();

        if (!available) {
          setHasError(true);
          setProgressLabel(
            "WinGet required"
          );
          setStatus(
            "WinGet is not installed or cannot be executed."
          );
          return;
        }
      }

      /* -------------------------------------------------
       * AUTO VALIDATION
       * ------------------------------------------------- */

      if (
        mode === "auto"
      ) {
        const managers =
          await refreshPm();

        if (
          !managers.winget &&
          !managers.choco
        ) {
          setHasError(true);
          setProgressLabel(
            "Package manager required"
          );
          setStatus(
            "Neither WinGet nor Chocolatey is available."
          );
          return;
        }
      }

      /* -------------------------------------------------
       * START
       * ------------------------------------------------- */

      if (
        !startOperation(
          "Installing applications",
          [
            `PS> Installing ${apps.length} application${
              apps.length === 1
                ? ""
                : "s"
            }...`,
            "",
          ]
        )
      ) {
        return;
      }

      try {
        setProgress(10);

        const results =
          await api.install(
            apps,
            mode
          );

        const normalized =
          Array.isArray(results)
            ? results
            : [];

        const failed =
          normalized.filter(
            (result) =>
              !result?.ok
          );

        const successful =
          normalized.filter(
            (result) =>
              result?.ok
          );

        /*
         * If backend returned no result array,
         * do not pretend everything succeeded.
         */
        if (
          !normalized.length &&
          apps.length
        ) {
          throw new Error(
            "The installer returned no results."
          );
        }

        setProgress(90);

        if (
          failed.length
        ) {
          const failedNames =
            failed.map(
              (result) =>
                BY_ID[
                  result.id
                ]?.name ??
                result.id ??
                "Unknown application"
            );

          setHasError(true);

          setSelected(
            new Set(
              failed
                .map(
                  (result) =>
                    result.id
                )
                .filter(Boolean)
            )
          );

          finishOperation({
            label:
              "Installation finished with errors",
            progress: 100,
            status:
              `${successful.length}/${apps.length} installed. Failed: ${failedNames.join(
                ", "
              )}`,
          });
        } else {
          setSelected(
            new Set()
          );

          finishOperation({
            label:
              "Installation complete",
            status:
              "Installation completed successfully.",
          });
        }

        await refreshInstalled();
      } catch (error) {
        failOperation(
          "Installation failed",
          error
        );
      }
    }, [
      available,
      checkChocolatey,
      checkWinget,
      failOperation,
      finishOperation,
      mode,
      refreshInstalled,
      refreshPm,
      selected,
      setHasError,
      setProgress,
      setProgressLabel,
      setStatus,
      startOperation,
    ]);

  /* =======================================================
   * UPGRADE ALL
   * ======================================================= */

  const upgradeAll =
    useCallback(async () => {
      if (
        operationRef.current
      ) {
        return;
      }

      /*
       * Validation errors below must land on the Apps channel.
       */
      scopeRef.current = "apps";

      if (
        mode === "winget"
      ) {
        const available =
          await checkWinget();

        if (!available) {
          setHasError(true);
          setProgressLabel(
            "WinGet required"
          );
          setStatus(
            "WinGet is not installed or cannot be executed."
          );
          return;
        }
      }

      if (
        mode === "choco"
      ) {
        const available =
          await checkChocolatey();

        if (!available) {
          setHasError(true);
          setProgressLabel(
            "Chocolatey required"
          );
          setStatus(
            "Chocolatey is not installed."
          );
          return;
        }
      }

      if (
        mode === "auto"
      ) {
        const managers =
          await refreshPm();

        if (
          !managers.winget &&
          !managers.choco
        ) {
          setHasError(true);
          setProgressLabel(
            "Package manager required"
          );
          setStatus(
            "Neither WinGet nor Chocolatey is available."
          );
          return;
        }
      }

      if (
        !startOperation(
          "Upgrading applications",
          [
            "PS> Starting application upgrade...",
            "",
          ]
        )
      ) {
        return;
      }

      try {
        setProgress(10);

        const result =
          await api.upgradeAll(
            mode
          );

        if (
          result === false
        ) {
          throw new Error(
            "Upgrade operation failed."
          );
        }

        setProgress(90);

        await refreshInstalled();

        finishOperation({
          label:
            "Upgrade complete",
          status:
            "Applications upgraded successfully.",
        });
      } catch (error) {
        failOperation(
          "Upgrade failed",
          error
        );
      }
    }, [
      checkChocolatey,
      checkWinget,
      failOperation,
      finishOperation,
      mode,
      refreshInstalled,
      refreshPm,
      setHasError,
      setProgress,
      setProgressLabel,
      setStatus,
      startOperation,
    ]);

  /* =======================================================
   * FILTERING
   * ======================================================= */

  const visible =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLowerCase();

      return APPS.filter(
        (app) => {
          const categoryMatch =
            category ===
              "All categories" ||
            app.category ===
              category;

          const audienceMatch =
            audience ===
              "Everyone" ||
            app.foss;

          const searchMatch =
            !q ||
            app.name
              .toLowerCase()
              .includes(q);

          return (
            categoryMatch &&
            audienceMatch &&
            searchMatch
          );
        }
      );
    }, [
      audience,
      category,
      query,
    ]);

  /* =======================================================
   * SELECTION
   * ======================================================= */

  const toggle =
    useCallback(
      (id) => {
        if (
          operationRef.current
        ) {
          return;
        }

        setSelected(
          (current) => {
            const next =
              new Set(current);

            if (
              next.has(id)
            ) {
              next.delete(id);
            } else {
              next.add(id);
            }

            return next;
          }
        );
      },
      []
    );

  const selectAll =
    useCallback(() => {
      if (
        operationRef.current
      ) {
        return;
      }

      setSelected(
        new Set(
          visible
            .filter(available)
            .map(
              (app) => app.id
            )
        )
      );
    }, [
      available,
      visible,
    ]);

  const deselectAll =
    useCallback(() => {
      if (
        operationRef.current
      ) {
        return;
      }

      setSelected(
        new Set()
      );
    }, []);

  /* =======================================================
   * MANAGER CHANGE
   * ======================================================= */

  const handleManagerChange =
    useCallback(
      (value) => {
        if (
          operationRef.current
        ) {
          return;
        }

        setManager(value);
      },
      []
    );

  /* =======================================================
   * REMOVE INVALID SELECTIONS
   * ======================================================= */

  useEffect(() => {
    setSelected(
      (current) => {
        const next =
          new Set(
            [...current].filter(
              (id) =>
                BY_ID[id] &&
                available(
                  BY_ID[id]
                )
            )
          );

        if (
          next.size ===
          current.size
        ) {
          return current;
        }

        return next;
      }
    );
  }, [available]);

  /* =======================================================
   * KEYBOARD SHORTCUTS
   * ======================================================= */

  useEffect(() => {
    const onKeyDown =
      (event) => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "f"
        ) {
          event.preventDefault();

          setTab("install");

          setTimeout(() => {
            searchRef.current?.focus();
          }, 50);
        }

        if (
          event.key ===
            "Escape" &&
          document.activeElement ===
            searchRef.current
        ) {
          setQuery("");
        }
      };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, []);

  /* =======================================================
   * DERIVED UI
   * ======================================================= */

  const sections = (
    category ===
    "All categories"
      ? CATEGORIES
      : [category]
  )
    .map((cat) => [
      cat,
      visible.filter(
        (app) =>
          app.category ===
          cat
      ),
    ])
    .filter(
      ([, items]) =>
        items.length > 0
    );

  const effectiveManager =
    mode === "auto"
      ? pm.winget
        ? "WinGet"
        : pm.choco
          ? "Chocolatey"
          : "No package manager"
      : manager;

  const needsChocolatey =
    mode === "choco" &&
    !pm.choco;

  const canReinstallChocolatey =
    pm.choco;

  const needsWinget =
    mode === "winget" &&
    !pm.winget;

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="flex h-full flex-col">
      {/* ===================================================
       * TITLE BAR
       * =================================================== */}

      <TitleBar
        api={api}
        title={
          sys
            ? `Open Windows Patcher - ${sys.app}`
            : "Open Windows Patcher"
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* =================================================
         * SIDEBAR
         * ================================================= */}

        <Rail
          tab={tab}
          onTab={setTab}
          selectedCount={
            selected.size
          }
          installedCount={
            installed.size
          }
          manager={`Installing with ${effectiveManager}`}
        />

        {/* =================================================
         * TWEAKS
         * ================================================= */}

        {tab === "tweaks" && (
          <Main>
            <div className="min-h-0 flex-1">
              <Tweaks run={runPs} />
            </div>

            <TweaksProgress
              running={tweaksProg.running}
              error={tweaksProg.error}
              label={tweaksProg.label}
              progress={tweaksProg.progress}
              status={tweaksProg.status}
            />
          </Main>
        )}

        {/* =================================================
         * CONFIG
         * ================================================= */}

        {tab === "config" && (
          <Main>
            <Config
              run={runPs}
            />
          </Main>
        )}

        {/* =================================================
         * UPDATES
         * ================================================= */}

        {tab === "updates" && (
          <Main>
            <Updates
              run={runPs}
            />
          </Main>
        )}

        {/* =================================================
         * REPORT
         * ================================================= */}

        {tab === "report" && (
          <Main>
            <Report
              lastStatus={
                tweaksProg.status
              }
            />
          </Main>
        )}

        {/* =================================================
         * INSTALL
         * ================================================= */}

        {tab === "install" && (
          <Main>
            <H1
              aside={`${visible.length} packages`}
            >
              Apps
            </H1>

            <Toolbar>
              {/* =========================================
               * SEARCH
               * ========================================= */}

              <label className="flex h-9 w-[260px] items-center gap-2 rounded-lg border border-line-2 bg-panel px-3 text-muted transition duration-150 hover:border-faint focus-within:border-accent/60 focus-within:bg-panel-2 focus-within:text-accent focus-within:shadow-[0_0_0_3px_rgba(95,208,230,.14)]">
                <Search size={15} />

                <input
                  ref={searchRef}
                  className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-faint disabled:opacity-60"
                  placeholder="Search packages (Ctrl+F)"
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  disabled={
                    isRunning
                  }
                />

                {query &&
                  !isRunning && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuery("")
                      }
                      aria-label="Clear search"
                      className="grid size-5 flex-none place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text"
                    >
                      <X size={12} />
                    </button>
                  )}
              </label>

              {/* =========================================
               * CATEGORY
               * ========================================= */}

              <Select
                label="Category"
                value={category}
                onChange={
                  setCategory
                }
                options={[
                  "All categories",
                  ...CATEGORIES,
                ]}
              />

              {/* =========================================
               * PACKAGE MANAGER
               * ========================================= */}

              <Select
                label="Package manager"
                value={manager}
                onChange={
                  handleManagerChange
                }
                options={Object.keys(
                  MANAGERS
                )}
              />

              {/* =========================================
               * AUDIENCE
               * ========================================= */}

              <Select
                label="Audience"
                value={audience}
                onChange={
                  setAudience
                }
                options={[
                  "Everyone",
                  "FOSS only",
                ]}
              />

              <span className="flex-1" />

              {/* =========================================
               * WINGET
               * ========================================= */}

              {needsWinget && (
                <Btn
                  disabled={
                    isRunning
                  }
                  onClick={
                    checkWingetStatus
                  }
                  title="Check whether WinGet is installed"
                >
                  Check WinGet
                </Btn>
              )}

              {mode === "winget" && (
                <Btn
                  variant="red"
                  disabled={
                    isRunning
                  }
                  onClick={
                    reinstallWinget
                  }
                >
                  Reinstall WinGet
                </Btn>
              )}

              {/* =========================================
               * CHOCOLATEY INSTALL
               * ========================================= */}

              {needsChocolatey && (
                <Btn
                  disabled={
                    isRunning
                  }
                  onClick={
                    installChocolatey
                  }
                  title="Install Chocolatey"
                >
                  Install Chocolatey
                </Btn>
              )}

              {/* =========================================
               * CHOCOLATEY REINSTALL
               * ========================================= */}

              {mode === "choco" &&
                canReinstallChocolatey && (
                  <Btn
                    variant="red"
                    disabled={
                      isRunning
                    }
                    onClick={
                      reinstallChocolatey
                    }
                    title="Remove, clean and reinstall Chocolatey"
                  >
                    Reinstall Chocolatey
                  </Btn>
                )}

              {/* =========================================
               * GENERAL
               * ========================================= */}

              <Btn
                variant="orange"
                disabled={
                  isRunning
                }
                onClick={
                  getInstalled
                }
              >
                Check installed
              </Btn>

              <Btn
                variant="teal"
                disabled={
                  isRunning
                }
                onClick={
                  upgradeAll
                }
              >
                Upgrade all
              </Btn>

              {/* =========================================
               * OPTIONAL REMOVE
               * ========================================= */}

              {mode === "choco" &&
                pm.choco && (
                  <Btn
                    variant="danger"
                    disabled={
                      isRunning
                    }
                    onClick={
                      removeChocolatey
                    }
                  >
                    Remove Chocolatey
                  </Btn>
                )}
            </Toolbar>

            {/* =================================================
             * PROGRESS (Apps channel only)
             * ================================================= */}

            <ProgressPanel
              running={appsProg.running}
              error={appsProg.error}
              label={appsProg.label}
              progress={appsProg.progress}
              status={appsProg.status}
            />

            {/* =================================================
             * APPLICATION LIST
             * ================================================= */}

            <Scroll>
              {sections.length ===
              0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-14 text-center text-muted">
                  <strong className="text-base font-semibold text-text">
                    No packages found
                  </strong>

                  <span>
                    Try a different
                    search, or switch
                    the category or
                    audience filter.
                  </span>
                </div>
              ) : (
                sections.map(
                  ([cat, items]) => (
                    <section
                      key={cat}
                    >
                      <H2
                        count={
                          items.length
                        }
                      >
                        {cat}
                      </H2>

                      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                        {items.map(
                          (app) => (
                            <AppTile
                              key={
                                app.id
                              }
                              app={app}
                              checked={selected.has(
                                app.id
                              )}
                              installed={installed.has(
                                app.id
                              )}
                              disabled={
                                isRunning
                              }
                              unavailable={
                                !available(
                                  app
                                )
                              }
                              onToggle={
                                toggle
                              }
                            />
                          )
                        )}
                      </div>
                    </section>
                  )
                )
              )}
            </Scroll>

            {/* =================================================
             * SELECTION BAR
             * ================================================= */}

            <div
              className={
                "mb-4 flex flex-none items-center gap-3 rounded-[14px] border border-line-2 bg-panel-2 px-4 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,.9)] transition-all duration-300 ease-out-expo " +
                (selected.size
                  ? "mt-3 translate-y-0 opacity-100"
                  : "pointer-events-none mt-0 h-0 translate-y-3 overflow-hidden border-transparent py-0 opacity-0")
              }
              aria-hidden={
                !selected.size
              }
            >
              <span className="font-display text-xl font-semibold tabular-nums">
                {selected.size}
              </span>

              <span className="text-muted">
                selected
              </span>

              <span className="flex-1" />

              <Btn
                variant="ghost"
                disabled={
                  isRunning ||
                  !visible.length
                }
                onClick={
                  selectAll
                }
              >
                Select all
              </Btn>

              <Btn
                variant="ghost"
                disabled={
                  isRunning ||
                  !selected.size
                }
                onClick={
                  deselectAll
                }
              >
                Clear
              </Btn>

              <Btn
                variant="primary"
                disabled={
                  !selected.size ||
                  isRunning
                }
                onClick={
                  installSelected
                }
              >
                Install{" "}
                {selected.size}{" "}
                {selected.size ===
                1
                  ? "app"
                  : "apps"}
              </Btn>
            </div>
          </Main>
        )}
      </div>
    </div>
  );
}
