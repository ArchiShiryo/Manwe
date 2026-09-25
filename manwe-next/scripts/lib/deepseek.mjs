// Client minimal de l'API DeepSeek (format compatible OpenAI) pour les
// évaluations automatiques. La clé n'est jamais écrite dans le dépôt :
// - dans une session cloud, le proxy de la session ajoute l'en-tête
//   Authorization aux requêtes vers api.deepseek.com ;
// - ailleurs, la variable d'environnement DEEPSEEK_API_KEY est utilisée.
// Derrière un proxy HTTP, Node doit être lancé avec NODE_USE_ENV_PROXY=1
// (voir withEnvProxy).
import { spawnSync } from "node:child_process";

// DEEPSEEK_BASE_URL permet aux tests de viser un serveur local simulé.
export const DEEPSEEK_ENDPOINT = `${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`;
export const DEFAULT_MODEL = "deepseek-flash"; // DeepSeek-V4.1-Flash
export const DEFAULT_EFFORT = "high";
const MAX_TOKENS = 64000;
const TRANSPORT_RETRIES = 4;
const CALL_TIMEOUT_MS = Number(
  process.env.DEEPSEEK_TIMEOUT_MS ?? 10 * 60 * 1000,
);

/**
 * Relance le script courant avec NODE_USE_ENV_PROXY=1 lorsqu'un proxy est
 * configuré, car fetch l'ignore sinon. Renvoie true si le processus enfant a
 * pris le relais.
 */
export function withEnvProxy() {
  const proxied = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxied || process.env.NODE_USE_ENV_PROXY === "1") return false;
  const result = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
  });
  process.exitCode = result.status ?? 1;
  return true;
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Envoie le prompt complet comme unique message utilisateur, comme lors des
 * évaluations assistées, et renvoie la réponse brute sans la modifier.
 */
export async function callAnalyst({
  prompt,
  model = DEFAULT_MODEL,
  effort = DEFAULT_EFFORT,
}) {
  const headers = { "content-type": "application/json" };
  if (process.env.DEEPSEEK_API_KEY)
    headers.authorization = `Bearer ${process.env.DEEPSEEK_API_KEY}`;
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    reasoning_effort: effort,
    max_tokens: MAX_TOKENS,
  });
  let lastError = null;
  for (let attempt = 0; attempt <= TRANSPORT_RETRIES; attempt += 1) {
    if (attempt) await pause(2000 * 2 ** (attempt - 1));
    const startedAt = new Date();
    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers,
        body,
        // Un appel ne doit jamais bloquer le lot indéfiniment.
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      const text = await response.text();
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          `HTTP ${response.status} : ${text.slice(0, 300)}`,
        );
        continue;
      }
      if (!response.ok)
        throw new Error(`HTTP ${response.status} : ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content ?? "",
        reasoning: choice?.message?.reasoning_content ?? null,
        meta: {
          provider: "deepseek",
          requestedModel: model,
          servedModel: data.model ?? null,
          effort,
          finishReason: choice?.finish_reason ?? null,
          usage: data.usage ?? null,
          startedAt: startedAt.toISOString(),
          latencyMs: Date.now() - startedAt.getTime(),
          transportAttempts: attempt + 1,
        },
      };
    } catch (error) {
      if (String(error.message).startsWith("HTTP ")) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error("Appel DeepSeek impossible.");
}
