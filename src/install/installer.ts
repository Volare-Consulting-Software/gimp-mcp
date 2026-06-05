import { currentPlatform } from "../gimp/locator.js";
import type { Platform } from "../gimp/types.js";

/** Official GIMP download page — the universal, all-OS install option. */
export const GIMP_DOWNLOAD_URL = "https://www.gimp.org/downloads/";

/** A package-manager command we can suggest (never run) for a platform. */
export interface InstallHint {
  manager: string;
  /** One-line command for display / copy-paste. */
  display: string;
  /** Extra context (requirements, caveats). */
  note?: string;
}

function hintsFor(platform: Platform): InstallHint[] {
  switch (platform) {
    case "windows":
      return [
        { manager: "winget", display: "winget install --id GIMP.GIMP -e" },
        {
          manager: "choco",
          display: "choco install gimp -y",
          note: "Requires Chocolatey and an elevated (admin) shell.",
        },
      ];
    case "macos":
      return [
        {
          manager: "brew",
          display: "brew install --cask gimp",
          note: "Requires Homebrew (https://brew.sh).",
        },
      ];
    case "linux":
      return [
        {
          manager: "flatpak",
          display: "flatpak install -y flathub org.gimp.GIMP",
          note: "Recommended for GIMP 3.x. Requires Flatpak + the Flathub remote.",
        },
        {
          manager: "apt",
          display: "sudo apt install -y gimp",
          note: "Debian/Ubuntu repos may ship an older GIMP.",
        },
        { manager: "dnf", display: "sudo dnf install -y gimp", note: "Fedora/RHEL." },
      ];
  }
}

export interface InstallInstructions {
  platform: Platform;
  downloadUrl: string;
  hints: InstallHint[];
}

/** Build install guidance for the current host. The MCP never runs installers. */
export function installInstructions(): InstallInstructions {
  const platform = currentPlatform();
  return { platform, downloadUrl: GIMP_DOWNLOAD_URL, hints: hintsFor(platform) };
}

/** Render install guidance as human-readable lines. */
export function formatInstallInstructions(): string {
  const { platform, downloadUrl, hints } = installInstructions();
  const lines = [
    `Install GIMP for ${platform}:`,
    "",
    `  1) Download the official installer (all platforms): ${downloadUrl}`,
  ];
  if (hints.length > 0) {
    lines.push("", "  Or use a package manager:");
    for (const hint of hints) {
      lines.push(`    - ${hint.display}`);
      if (hint.note) lines.push(`        (${hint.note})`);
    }
  }
  lines.push(
    "",
    "After installing, the server finds GIMP automatically. If it is in a custom",
    "location, set GIMP_CONSOLE_PATH to the full path of the gimp-console executable.",
  );
  return lines.join("\n");
}
