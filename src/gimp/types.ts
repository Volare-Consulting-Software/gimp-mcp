/** Shared domain types for locating and driving GIMP. */

/**
 * A resolved way to invoke GIMP's console binary.
 *
 * `command` + `args` are spawned directly (no shell). For a normal install
 * `command` is the absolute path / bare name and `args` is empty; for a
 * Flatpak install `command` is `flatpak` and `args` carries the run wrapper.
 */
export interface GimpLocation {
  /** Executable to spawn (absolute path, bare name resolved via PATH, or `flatpak`). */
  command: string;
  /** Leading args that must precede every invocation (e.g. the Flatpak wrapper). */
  args: string[];
  /** Reported version string, or null if `--version` could not be parsed. */
  version: string | null;
  /** How the binary was found, for diagnostics. */
  source: string;
}

/** Result of a completed GIMP batch invocation. */
export interface RunResult {
  stdout: string;
  stderr: string;
}

/** Supported host platforms for install guidance. */
export type Platform = "windows" | "macos" | "linux";
