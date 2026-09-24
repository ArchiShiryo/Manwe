import { join } from "node:path";
import { startManweServer } from "./server.ts";

const localDataRoot = process.env.LOCALAPPDATA;
if (!localDataRoot) throw new Error("LOCALAPPDATA est indisponible.");

const databasePath =
  process.env.MANWE_DATABASE_PATH ??
  join(localDataRoot, "ManweNext", "memory.sqlite3");
const workspaceId = process.env.MANWE_WORKSPACE_ID ?? "personal";
const port = Number(process.env.MANWE_SERVER_PORT ?? 5181);
const allowedOrigin = process.env.MANWE_UI_ORIGIN ?? "http://127.0.0.1:5180";
const running = await startManweServer({
  databasePath,
  workspaceId,
  port,
  allowedOrigin,
});

console.log(`MANWË memory ready at ${running.origin}`);
console.log(`Database: ${databasePath}`);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await running.close();
  process.exit(0);
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
