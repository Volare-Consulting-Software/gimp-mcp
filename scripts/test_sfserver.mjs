// De-risk: can we run GIMP 3.2's Script-Fu TCP server, speak its protocol from
// Node, and does state persist across separate commands?
import { spawn } from "node:child_process";
import net from "node:net";

const exe =
  process.env.GIMP_CONSOLE_PATH ||
  "C:\\Users\\admin\\AppData\\Local\\Programs\\GIMP 3\\bin\\gimp-console-3.2.exe";
const PORT = 10008;
const LOG = "C:/git/sf_inner.log";
const startCmd =
  process.argv[2] || `(plug-in-script-fu-server 1 "127.0.0.1" ${PORT} "${LOG}")`;

console.log("start cmd:", startCmd);
const child = spawn(
  exe,
  ["-i", "--batch-interpreter=plug-in-script-fu-eval", "-b", startCmd],
  { windowsHide: true },
);
let diag = "";
child.stderr.on("data", (d) => (diag += d));
child.stdout.on("data", (d) => (diag += "OUT:" + d));
child.on("close", (c) => console.log("CHILD EXITED code=", c, "\n--diag--\n", diag.slice(0, 1500)));

function sfSend(sock, cmd) {
  const buf = Buffer.from(cmd, "utf8");
  const header = Buffer.from([0x47, (buf.length >> 8) & 0xff, buf.length & 0xff]);
  sock.write(Buffer.concat([header, buf]));
  console.log(`> ${cmd}`);
}

async function connect() {
  for (let i = 0; i < 120; i++) {
    const s = await new Promise((res) => {
      const sock = net.connect(PORT, "127.0.0.1", () => res(sock));
      sock.on("error", () => res(null));
    });
    if (s) return s;
    if (i % 10 === 9) console.log(`...waiting (${(i + 1) / 2}s). diag:`, JSON.stringify(diag.slice(-300)));
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const sock = await connect();
if (!sock) {
  console.log("COULD NOT CONNECT. diag so far:\n", diag.slice(0, 1500));
  child.kill("SIGKILL");
  process.exit(1);
}
console.log("CONNECTED");
sock.on("data", (d) => {
  console.log("RAW bytes:", [...d.slice(0, 8)], "| TEXT:", JSON.stringify(d.toString("latin1").slice(0, 220)));
});

const steps = [
  "(gimp-version)",
  "(car (gimp-image-new 123 45 RGB))",
  "(gimp-image-list)", // should include the image made above => state persisted
  "(map (lambda (i) (list (car (gimp-image-get-width i)) (car (gimp-image-get-height i)))) (vector->list (car (gimp-image-list))))",
];
let i = 0;
const tick = setInterval(() => {
  if (i >= steps.length) {
    clearInterval(tick);
    child.kill("SIGKILL");
    setTimeout(() => process.exit(0), 300);
    return;
  }
  sfSend(sock, steps[i++]);
}, 1500);
