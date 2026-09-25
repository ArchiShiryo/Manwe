// Requêtes du modèle dans la mémoire (D-023). Lecture seule : elles ne
// modifient rien ; tout objet servi devient citable et référençable dans la
// proposition de la même analyse. Définitions au format « function calling »
// (API compatible OpenAI).

export const MEMORY_TOOL_NAMES = [
  "search_notes",
  "get_note",
  "get_person",
  "get_relation",
  "get_hypothesis",
] as const;
export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[number];

export const MEMORY_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_notes",
      description:
        "Cherche dans toutes les notes de l'utilisateur (texte, personne, période). Renvoie le texte intégral, citable, avec sourceId et contentHash.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Mots à chercher dans le texte.",
          },
          person: {
            type: "string",
            description: "Prénom d'une personne mentionnée.",
          },
          from: { type: "string", description: "Date ISO de début." },
          to: { type: "string", description: "Date ISO de fin." },
          limit: {
            type: "integer",
            description: "Nombre maximal de notes (20 au plus).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_note",
      description:
        "Relit une note entière (texte citable) par sourceId ou eventId, avec ses faits et rôles déjà extraits.",
      parameters: {
        type: "object",
        properties: {
          sourceId: { type: "string" },
          eventId: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_person",
      description:
        "Ouvre une personne (par personId ou prénom) : épisodes, rôles, relations et groupes avec indicateurs, lectures qui la concernent.",
      parameters: {
        type: "object",
        properties: { personId: { type: "string" }, name: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_relation",
      description:
        "Ouvre une relation ou un groupe : membres, indicateurs, rôles par épisode, lectures qui la visent.",
      parameters: {
        type: "object",
        properties: { relationId: { type: "string" } },
        required: ["relationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hypothesis",
      description:
        "Ouvre une lecture en entier : preuves avec leur texte et leurs citations, critiques, historique des révisions, alternative.",
      parameters: {
        type: "object",
        properties: { hypothesisId: { type: "string" } },
        required: ["hypothesisId"],
      },
    },
  },
] as const;
