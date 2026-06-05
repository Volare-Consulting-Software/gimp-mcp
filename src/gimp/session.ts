import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";

import { requireGimp } from "./locator.js";
import { logger } from "../util/logger.js";

/**
 * A persistent, stateful GIMP session backed by GIMP's built-in Script-Fu TCP
 * server. One `gimp-console` process stays alive with the full PDB; we send one
 * Script-Fu command per call over the socket, and ALL state (open images,
 * selections, layers, context) persists between calls — exactly like working
 * in the GIMP UI.
 *
 * Wire protocol (reverse-engineered against GIMP 3.2):
 *   request : 0x47 'G' | len_hi | len_lo | <command bytes>
 *   response: 0x47 'G' | error  | len_hi | len_lo | <message bytes>
 *             error byte: 0 = success, 1 = Script-Fu error (message is the text)
 *
 * The length field is 16-bit, so a single command (and a single response) is
 * capped at 65535 bytes by the protocol itself.
 *
 * Commands are strictly serialized: GIMP's Script-Fu server processes one
 * command at a time, and the response stream is matched to requests by order,
 * so we never have more than one command in flight.
 */

const MAGIC = 0x47;
const HOST = "127.0.0.1";
/** Wire protocol length field is 16-bit. */
const MAX_BODY = 0xffff;
const HEADER_LEN = 4;
/** How long to keep retrying the TCP connect while GIMP boots its server. */
const CONNECT_DEADLINE_MS = 90_000;
const CONNECT_RETRY_MS = 500;
/** Per-command timeout. A first-ever command on a cold install can be slow. */
const DEFAULT_EVAL_TIMEOUT_MS = 120_000;

interface Pending {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
}

export interface Frame {
  error: number;
  message: string;
}

/**
 * Pure framing parser: pull every complete response frame out of `buffer`,
 * returning the frames plus any trailing partial bytes. Resynchronizes by
 * dropping bytes until a MAGIC byte is found. Exported for unit testing.
 */
export function parseFrames(buffer: Buffer): { frames: Frame[]; rest: Buffer } {
  const frames: Frame[] = [];
  let buf = buffer;
  while (buf.length >= HEADER_LEN) {
    if (buf[0] !== MAGIC) {
      // Desync — drop a byte and resync.
      buf = buf.subarray(1);
      continue;
    }
    const error = buf[1]!;
    const len = (buf[2]! << 8) | buf[3]!;
    if (buf.length < HEADER_LEN + len) break; // wait for the rest of the body
    const message = buf.subarray(HEADER_LEN, HEADER_LEN + len).toString("utf8");
    buf = buf.subarray(HEADER_LEN + len);
    frames.push({ error, message });
  }
  return { frames, rest: buf };
}

export class GimpSession {
  private child: ChildProcess | null = null;
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  /** At most one command is in flight at a time (commands are serialized). */
  private pending: Pending | null = null;
  private starting: Promise<void> | null = null;
  /** Tail of the serialization chain; each eval waits for the previous. */
  private chain: Promise<unknown> = Promise.resolve();
  private readonly port = Number(process.env["GIMP_MCP_PORT"]) || 10008;

  /**
   * Evaluate one Script-Fu command in the live session and return its result
   * text (the Scheme value as printed). Throws with the GIMP message on error.
   * Calls are serialized — each waits for the previous to settle — so the
   * stateful session stays consistent even under concurrent tool dispatch.
   */
  async eval(command: string, options: { timeoutMs?: number } = {}): Promise<string> {
    const run = this.chain.then(
      () => this.runOne(command, options),
      () => this.runOne(command, options),
    );
    // Keep the chain alive regardless of this call's outcome.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runOne(command: string, options: { timeoutMs?: number }): Promise<string> {
    await this.ensureStarted();
    const socket = this.socket;
    if (!socket) throw new Error("GIMP session is not connected.");

    const body = Buffer.from(command, "utf8");
    if (body.length > MAX_BODY) {
      throw new Error(
        `Script-Fu command too large (${body.length} bytes). GIMP's Script-Fu ` +
          `server caps each command at ${MAX_BODY} bytes; split it into smaller calls.`,
      );
    }
    const header = Buffer.from([MAGIC, (body.length >> 8) & 0xff, body.length & 0xff]);

    return new Promise<string>((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? DEFAULT_EVAL_TIMEOUT_MS;
      const timer = setTimeout(() => {
        // The late response would desync the byte stream, so reset the session.
        this.teardown(
          new Error(`GIMP command timed out after ${timeoutMs}ms: ${command.slice(0, 80)}`),
        );
      }, timeoutMs);
      this.pending = {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      socket.write(Buffer.concat([header, body]));
      logger.debug(`> ${command}`);
    });
  }

  /** Start the server (if needed) and return once it accepts commands. */
  private async ensureStarted(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return;
    if (this.starting) return this.starting;
    this.starting = this.start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async start(): Promise<void> {
    const location = await requireGimp();
    const serverCmd = `(plug-in-script-fu-server 1 "${HOST}" ${this.port} "")`;
    logger.info(
      `starting GIMP Script-Fu session on ${HOST}:${this.port} (first start can take ~30-60s)`,
    );

    const child = spawn(
      location.command,
      [...location.args, "-i", "--batch-interpreter=plug-in-script-fu-eval", "-b", serverCmd],
      { windowsHide: true },
    );
    this.child = child;
    child.on("exit", (code) => {
      logger.warn(`GIMP session process exited (code ${code})`);
      this.teardown(new Error("GIMP session process exited; open images were lost."));
    });
    // GIMP prints a welcome banner / warnings to stderr; surface only on debug.
    child.stderr?.on("data", (d: Buffer) => logger.debug(`gimp: ${d.toString().trim()}`));

    this.socket = await this.connectWithRetry();
    this.socket.on("data", (d) => this.onData(d));
    this.socket.on("error", (err) => this.teardown(err));
    this.socket.on("close", () => this.teardown(new Error("GIMP session socket closed")));
    logger.info("GIMP session ready.");
  }

  private async connectWithRetry(): Promise<net.Socket> {
    const deadline = Date.now() + CONNECT_DEADLINE_MS;
    let lastErrMsg = "";
    while (Date.now() < deadline) {
      if (!this.child || this.child.exitCode !== null) {
        throw new Error("GIMP exited before the Script-Fu server became reachable.");
      }
      const sock = await new Promise<net.Socket | null>((resolve) => {
        const s = net.connect(this.port, HOST, () => resolve(s));
        s.on("error", (e) => {
          lastErrMsg = e.message;
          resolve(null);
        });
      });
      if (sock) return sock;
      await delay(CONNECT_RETRY_MS);
    }
    throw new Error(
      `Timed out connecting to the GIMP Script-Fu server on ${HOST}:${this.port}. ` +
        `Is port ${this.port} already in use? Set GIMP_MCP_PORT to a free port. (${lastErrMsg})`,
    );
  }

  private onData(chunk: Buffer): void {
    const { frames, rest } = parseFrames(Buffer.concat([this.buffer, chunk]));
    this.buffer = rest;
    for (const frame of frames) {
      const pending = this.pending;
      this.pending = null;
      if (!pending) continue; // unexpected frame (e.g. after a timeout teardown)
      if (frame.error === 0) pending.resolve(frame.message);
      else pending.reject(new Error(frame.message.replace(/^Error:\s*/, "").trim()));
    }
  }

  /** Tear everything down and reject any in-flight command. Idempotent. */
  private teardown(err: Error): void {
    if (!this.socket && !this.child && !this.pending) return;
    if (this.pending) {
      this.pending.reject(err);
      this.pending = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.buffer = Buffer.alloc(0);
    if (this.child) {
      this.child.removeAllListeners("exit");
      if (this.child.exitCode === null) killProcessTree(this.child);
      this.child = null;
    }
  }

  stop(): void {
    this.teardown(new Error("session stopped"));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Kill the GIMP process *and its children*. `gimp-console` launches a separate
 * `script-fu` / `script-fu-server` process that actually holds the TCP port;
 * killing only the direct child (especially `SIGKILL` on Windows, which doesn't
 * cascade) would leave that grandchild orphaned on the port and break the next
 * session start. On Windows we use `taskkill /T`; elsewhere `SIGKILL` suffices.
 */
function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // Process already gone.
  }
}

/** Process-wide singleton session. */
export const session = new GimpSession();
