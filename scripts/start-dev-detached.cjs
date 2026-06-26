const { spawn } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = path.join(
  process.env.USERPROFILE ?? "",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "node",
  "bin"
);

const child = spawn(
  "cmd.exe",
  ["/c", ".\\node_modules\\.bin\\next.cmd", "dev", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      PATH: `${nodeBin};${process.env.PATH ?? ""}`
    }
  }
);

child.unref();
console.log(child.pid);
