// Isolate GIMP batch behaviour with clean (array) arg passing, no PowerShell,
// no MCP. Times a trivial batch and prints whatever GIMP emits.
import { spawn } from "node:child_process";

const exe =
  process.env.GIMP_CONSOLE_PATH ||
  "C:\\Users\\admin\\AppData\\Local\\Programs\\GIMP 3\\bin\\gimp-console-3.2.exe";

import { readFileSync } from "node:fs";
const arg = process.argv[2] || '(gimp-message "PROBE-OK")';
const script = arg.startsWith("@") ? readFileSync(arg.slice(1), "utf8") : arg;
const args = [
  "-n",
  "-i",
  "-d",
  "--batch-interpreter=plug-in-script-fu-eval",
  "-b",
  script,
  "-b",
  "(gimp-quit 0)",
];

console.log(`spawning: ${exe}`);
console.log(`args: ${JSON.stringify(args)}`);
const start = Date.now();
const child = spawn(exe, args, { windowsHide: true });

let out = "";
let err = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => (err += d));

const KILL_MS = Number(process.env.PROBE_KILL_MS) || 90_000;
const timer = setTimeout(() => {
  console.log(`\nNO EXIT after ${KILL_MS}ms — killing. Partial stdout/stderr below:`);
  console.log("STDOUT:", JSON.stringify(out));
  console.log("STDERR:", JSON.stringify(err));
  child.kill("SIGKILL");
  process.exit(2);
}, KILL_MS);

child.on("error", (e) => {
  clearTimeout(timer);
  console.log("SPAWN ERROR:", e.message);
  process.exit(3);
});
child.on("close", (code) => {
  clearTimeout(timer);
  console.log(`\nEXITED code=${code} in ${Date.now() - start}ms`);
  console.log("STDOUT:", JSON.stringify(out));
  console.log("STDERR:", JSON.stringify(err));
  process.exit(0);
});
