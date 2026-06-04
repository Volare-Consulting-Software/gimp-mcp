import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { logger } from "../util/logger.js";
import { runProcess } from "./process.js";
import type { GimpLocation, Platform } from "./types.js";

/** Identify the host platform in the terms the rest of the package uses. */
export function currentPlatform(): Platform {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    default:
      return "linux";
  }
}

interface Candidate {
  command: string;
  args: string[];
  source: string;
}

/** Bare console binary names, tried via PATH resolution. */
const PATH_NAMES = [
  "gimp-console",
  "gimp-console-3.2",
  "gimp-console-3.0",
  "gimp-console-3",
  "gimp-console-2.99",
  "gimp-console-2.10",
];

function windowsCandidates(): Candidate[] {
  const candidates: Candidate[] = [];
  const localPrograms = process.env["LOCALAPPDATA"]
    ? join(process.env["LOCALAPPDATA"]!, "Programs")
    : undefined;
  // winget installs GIMP 3.x per-user under %LOCALAPPDATA%\Programs by default;
  // the classic installer uses Program Files. Scan all of them.
  const roots = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    localPrograms,
  ].filter((root): root is string => Boolean(root));

  for (const root of roots) {
    let entries: string[] = [];
    try {
      entries = readdirSync(root).filter((name) => name.toUpperCase().startsWith("GIMP"));
    } catch {
      continue;
    }
    for (const dir of entries) {
      const bin = join(root, dir, "bin");
      let binEntries: string[] = [];
      try {
        binEntries = readdirSync(bin);
      } catch {
        continue;
      }
      for (const file of binEntries) {
        if (/^gimp-console.*\.exe$/i.test(file)) {
          candidates.push({ command: join(bin, file), args: [], source: `windows:${dir}` });
        }
      }
    }
  }
  return candidates;
}

function macosCandidates(): Candidate[] {
  const paths = [
    "/Applications/GIMP.app/Contents/MacOS/gimp-console",
    "/Applications/GIMP.app/Contents/MacOS/gimp",
  ];
  return paths
    .filter((path) => existsSync(path))
    .map((path) => ({ command: path, args: [], source: "macos:Applications" }));
}

function linuxCandidates(): Candidate[] {
  const paths = ["/usr/bin/gimp-console", "/usr/local/bin/gimp-console", "/snap/bin/gimp-console"];
  return paths
    .filter((path) => existsSync(path))
    .map((path) => ({ command: path, args: [], source: "linux:abs" }));
}

function buildCandidates(): Candidate[] {
  const candidates: Candidate[] = [];

  const override = process.env["GIMP_CONSOLE_PATH"];
  if (override) {
    candidates.push({ command: override, args: [], source: "env:GIMP_CONSOLE_PATH" });
  }

  for (const name of PATH_NAMES) {
    candidates.push({ command: name, args: [], source: `path:${name}` });
  }

  switch (currentPlatform()) {
    case "windows":
      candidates.push(...windowsCandidates());
      break;
    case "macos":
      candidates.push(...macosCandidates());
      break;
    case "linux":
      candidates.push(...linuxCandidates());
      break;
  }

  // Flatpak (any platform that has it, realistically Linux).
  candidates.push({
    command: "flatpak",
    args: ["run", "--command=gimp-console", "org.gimp.GIMP"],
    source: "flatpak:org.gimp.GIMP",
  });

  return candidates;
}

/** Extract a version like `3.0.4` from a `gimp --version` line. */
function parseVersion(output: string): string | null {
  const match = output.match(/\b(\d+\.\d+(?:\.\d+)?)\b/);
  return match ? match[1]! : null;
}

async function probe(candidate: Candidate): Promise<GimpLocation | null> {
  try {
    const result = await runProcess(candidate.command, [...candidate.args, "--version"], {
      timeoutMs: 20_000,
    });
    if (result.timedOut) return null;
    const text = `${result.stdout}\n${result.stderr}`;
    if (!/gimp/i.test(text) && result.code !== 0) return null;
    return {
      command: candidate.command,
      args: candidate.args,
      version: parseVersion(text),
      source: candidate.source,
    };
  } catch {
    // ENOENT and friends: this candidate is not installed here.
    return null;
  }
}

let cached: GimpLocation | null | undefined;

/**
 * Locate a usable `gimp-console`. Probes the env override, PATH, well-known
 * install locations, and Flatpak, returning the first that responds to
 * `--version`. Result is memoised; pass `force` to re-probe.
 */
export async function findGimpConsole(force = false): Promise<GimpLocation | null> {
  if (!force && cached !== undefined) return cached;

  for (const candidate of buildCandidates()) {
    const location = await probe(candidate);
    if (location) {
      logger.info(
        `found gimp-console via ${location.source}` +
          (location.version ? ` (v${location.version})` : ""),
      );
      cached = location;
      return location;
    }
  }

  logger.warn("gimp-console not found on this machine");
  cached = null;
  return null;
}

/** Resolve a location or throw a clear, actionable error. */
export async function requireGimp(): Promise<GimpLocation> {
  const location = await findGimpConsole();
  if (!location) {
    throw new Error(
      "GIMP was not found on this machine. Run the `gimp_doctor` tool to diagnose, " +
        "or `install_gimp` to install it. If GIMP is installed in a non-standard " +
        "location, set the GIMP_CONSOLE_PATH environment variable to the full path of " +
        "the gimp-console executable.",
    );
  }
  return location;
}
