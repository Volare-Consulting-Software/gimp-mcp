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
 */

const MAGIC = 0x47;
const HOST = "127.0.0.1";

interface Pending {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
}

export class GimpSession {
  private child: ChildProcess | null = null;
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private readonly queue: Pending[] = [];
  private starting: Promise<void> | null = null;
  private readonly port = Number(process.env["GIMP_MCP_PORT"]) || 10008;

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
    logger.info(`starting GIMP Script-Fu session on ${HOST}:${this.port} (first start can take ~30-60s)`);

    this.child = spawn(
      location.command,
      [...location.args, "-i", "--batch-interpreter=plug-in-script-fu-eval", "-b", serverCmd],
      { windowsHide: true },
    );
    this.child.on("exit", (code) => {
      logger.warn(`GIMP session process exited (code ${code})`);
      this.teardown(new Error("GIMP session process exited"));
    });
    // GIMP prints a welcome banner / warnings to stderr; surface only on debug.
    this.child.stderr?.on("data", (d: Buffer) => logger.debug(`gimp: ${d.toString().trim()}`));

    this.socket = await this.connectWithRetry();
    this.socket.on("data", (d) => this.onData(d));
    this.socket.on("error", (err) => this.teardown(err));
    this.socket.on("close", () => this.teardown(new Error("GIMP session socket closed")));
    logger.info("GIMP session ready.");
  }

  private async connectWithRetry(): Promise<net.Socket> {
    const deadline = Date.now() + 90_000;
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
      await delay(500);
    }
    throw new Error(`Timed out connecting to the GIMP Script-Fu server: ${lastErrMsg}`);
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      if (this.buffer[0] !== MAGIC) {
        // Desync — drop a byte and resync.
        this.buffer = this.buffer.subarray(1);
        continue;
      }
      const error = this.buffer[1]!;
      const len = (this.buffer[2]! << 8) | this.buffer[3]!;
      if (this.buffer.length < 4 + len) return;
      const message = this.buffer.subarray(4, 4 + len).toString("utf8");
      this.buffer = this.buffer.subarray(4 + len);
      const pending = this.queue.shift();
      if (!pending) continue;
      if (error === 0) pending.resolve(message);
      else pending.reject(new Error(message.replace(/^Error:\s*/, "").trim()));
    }
  }

  private teardown(err: Error): void {
    for (const p of this.queue.splice(0)) p.reject(err);
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.buffer = Buffer.alloc(0);
    if (this.child && this.child.exitCode === null) this.child.kill("SIGKILL");
    this.child = null;
  }

  /**
   * Evaluate one Script-Fu command in the live session and return its result
   * text (the Scheme value as printed). Throws with the GIMP message on error.
   */
  async eval(command: string, options: { timeoutMs?: number } = {}): Promise<string> {
    await this.ensureStarted();
    const socket = this.socket;
    if (!socket) throw new Error("GIMP session is not connected.");

    const body = Buffer.from(command, "utf8");
    const header = Buffer.from([MAGIC, (body.length >> 8) & 0xff, body.length & 0xff]);

    return new Promise<string>((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? 120_000;
      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(pending);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error(`GIMP command timed out after ${timeoutMs}ms: ${command.slice(0, 80)}`));
      }, timeoutMs);
      const pending: Pending = {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      this.queue.push(pending);
      socket.write(Buffer.concat([header, body]));
      logger.debug(`> ${command}`);
    });
  }

  stop(): void {
    this.teardown(new Error("session stopped"));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Process-wide singleton session. */
export const session = new GimpSession();
