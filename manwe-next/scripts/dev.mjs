import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, ["apps/server/src/main.ts"], {
    cwd: root,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5180",
      "--strictPort",
      ...process.argv.slice(2),
    ],
    {
      cwd: root,
      stdio: "inherit",
    },
  ),
];

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 250).unref();
}

for (const child of children) {
  child.once("error", (error) => {
    console.error(error.message);
    close(1);
  });
  child.once("exit", (code, signal) => {
    if (!closing) close(code ?? (signal ? 1 : 0));
  });
}
process.on("SIGINT", () => close());
process.on("SIGTERM", () => close());
