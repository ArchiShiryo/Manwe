import { join } from "node:path";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const localDataRoot = process.env.LOCALAPPDATA;
if (!localDataRoot) throw new Error("LOCALAPPDATA est indisponible.");

const databasePath =
  process.env.MANWE_DATABASE_PATH ??
  join(localDataRoot, "ManweNext", "memory.sqlite3");
const stamp = new Date().toISOString().replaceAll(":", "-");
const destination = join(
  localDataRoot,
  "ManweNext",
  "backups",
  `memory-${stamp}.sqlite3`,
);

const store = new SqliteMemoryStore(databasePath);
try {
  console.log(`Sauvegarde créée : ${store.backup(destination)}`);
} finally {
  store.close();
}
