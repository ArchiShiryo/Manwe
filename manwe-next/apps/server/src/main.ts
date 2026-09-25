import { join } from "node:path";
import { startManweServer } from "./server.ts";
import { createDeepSeekCall, type ProviderConfig } from "./analystProvider.ts";

const localDataRoot = process.env.LOCALAPPDATA;
if (!localDataRoot) throw new Error("LOCALAPPDATA est indisponible.");

const databasePath =
  process.env.MANWE_DATABASE_PATH ??
  join(localDataRoot, "ManweNext", "memory.sqlite3");
const workspaceId = process.env.MANWE_WORKSPACE_ID ?? "personal";
const port = Number(process.env.MANWE_SERVER_PORT ?? 5181);
const allowedOrigin = process.env.MANWE_UI_ORIGIN ?? "http://127.0.0.1:5180";
// IA-A.2 : l'analyse automatique n'existe que si elle est demandée
// explicitement. La clé vient de DEEPSEEK_API_KEY ou du proxy de la session
// cloud ; elle n'est jamais écrite ni journalisée.
let analyst: ProviderConfig | null = null;
if (process.env.MANWE_ANALYST_PROVIDER === "deepseek") {
  const model = process.env.MANWE_ANALYST_MODEL ?? "deepseek-flash";
  const budget = Number(process.env.MANWE_ANALYST_DAILY_TOKENS ?? 2_000_000);
  analyst = {
    id: `deepseek:${model}`,
    model,
    // IA-A.4 : 2 millions de jetons par jour par défaut ; 0 ou moins = sans plafond.
    dailyTokenBudget: Number.isFinite(budget) && budget > 0 ? budget : null,
    call: createDeepSeekCall({
      endpoint: process.env.DEEPSEEK_BASE_URL,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model,
      effort: process.env.MANWE_ANALYST_EFFORT ?? "high",
    }),
  };
  if (
    (process.env.HTTPS_PROXY || process.env.https_proxy) &&
    process.env.NODE_USE_ENV_PROXY !== "1"
  )
    console.warn(
      "Proxy détecté : relancer avec NODE_USE_ENV_PROXY=1 pour joindre le fournisseur.",
    );
}
// D-028 : silence attendu après la dernière note avant que l'agent analyse.
const quiet = Number(process.env.MANWE_AGENT_QUIET_MS ?? 12_000);
const running = await startManweServer({
  databasePath,
  workspaceId,
  port,
  allowedOrigin,
  analyst,
  agent: { quietMs: Number.isFinite(quiet) && quiet >= 0 ? quiet : 12_000 },
});

console.log(`MANWË memory ready at ${running.origin}`);
console.log(
  analyst
    ? `Analyse automatique : ${analyst.id}`
    : "Analyse automatique : désactivée (MANWE_ANALYST_PROVIDER non défini)",
);
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
