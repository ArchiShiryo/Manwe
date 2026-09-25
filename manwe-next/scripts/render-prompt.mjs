// Rend le gabarit du prompt analyste depuis le registre ontologique (R4.0d).
//   node scripts/render-prompt.mjs packages/cognition/prompts/analyst-v10.md
// Une nouvelle version de prompt se prépare en modifiant le gabarit, puis en
// rendant un NOUVEAU fichier : un prompt déjà évalué n'est jamais réécrit.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { renderPrompt } from "../packages/cognition/src/ontology.ts";

const output = process.argv[2];
if (!output) {
  console.error("Usage : node scripts/render-prompt.mjs <fichier de sortie>");
  process.exit(1);
}
if (existsSync(output)) {
  console.error(`${output} existe déjà : un prompt évalué ne se réécrit pas.`);
  process.exit(1);
}
const template = readFileSync(
  new URL("../packages/cognition/prompts/analyst.template.md", import.meta.url),
  "utf8",
);
writeFileSync(output, renderPrompt(template));
console.log(`Prompt rendu : ${output}`);
