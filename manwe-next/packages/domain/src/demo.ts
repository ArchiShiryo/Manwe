export type Selection = {
  kind: "person" | "hypothesis" | "question" | "event" | "goal";
  id: string;
};
export type Page = "world" | "people" | "intentions" | "memory";
export type Person = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  role: string;
  color: string;
  context: string;
  description: string;
};
export type MemoryEvent = {
  id: string;
  title: string;
  text: string;
  date: string;
  personIds: string[];
  category: "reported" | "impression" | "note";
  source: string;
};
export type Annotation = {
  id: string;
  target: Selection;
  text: string;
  date: string;
};
export type DemoState = {
  version: 1;
  revision: number;
  events: MemoryEvent[];
  annotations: Annotation[];
  questionAnswer: "yes" | "activity" | "unknown" | null;
  goalText: string;
};

export const people: Person[] = [
  {
    id: "marc",
    name: "Marc Dupont",
    firstName: "Marc",
    initials: "MD",
    role: "Collègue · ami de jeu",
    color: "sage",
    context: "Travail",
    description:
      "Vos échanges se prolongent parfois hors du travail. Le jeu est un terrain commun ; la portée de ce rapprochement reste à explorer.",
  },
  {
    id: "lea",
    name: "Léa Martin",
    firstName: "Léa",
    initials: "LM",
    role: "Collègue · lien de groupe",
    color: "clay",
    context: "Travail",
    description:
      "Léa participe aux déjeuners du groupe. Vous avez évoqué son projet, mais les données manquent pour décrire une évolution de votre relation.",
  },
  {
    id: "claire",
    name: "Claire Morel",
    firstName: "Claire",
    initials: "CM",
    role: "Amie · lien de longue date",
    color: "blue",
    context: "Hors du travail",
    description:
      "Vous avez remarqué une réponse plus lente. Cette impression ne permet pas à elle seule de conclure à une prise de distance.",
  },
];

export const initialSelection: Selection = {
  kind: "hypothesis",
  id: "closeness",
};
export function createDemo(): DemoState {
  return {
    version: 1,
    revision: 1,
    annotations: [],
    questionAnswer: null,
    goalText: "Faire grandir des amitiés plus proches",
    events: [
      {
        id: "invite",
        title: "Une invitation à jouer",
        text: "Marc m’a proposé de jouer ensemble samedi. Nous en avions parlé pendant une pause au travail.",
        date: "2026-09-12T15:30:00-03:00",
        personIds: ["marc"],
        category: "reported",
        source: "Journal · scénario de démonstration",
      },
      {
        id: "lunch",
        title: "Un déjeuner à son initiative",
        text: "Marc est venu me proposer de déjeuner avec lui et Léa. Nous avons parlé de notre projet puis de jeux vidéo.",
        date: "2026-09-10T12:15:00-03:00",
        personIds: ["marc", "lea"],
        category: "reported",
        source: "Journal · scénario de démonstration",
      },
      {
        id: "context",
        title: "Un contexte encore partagé",
        text: "Nos échanges récents ont eu lieu au travail ou autour du jeu. Je n’ai pas encore rapporté de rencontre sans ces activités.",
        date: "2026-09-10T18:00:00-03:00",
        personIds: ["marc"],
        category: "reported",
        source: "Note de contexte · démonstration",
      },
      {
        id: "claire-note",
        title: "Une réponse plus tardive",
        text: "Claire a répondu deux jours après mon message. Elle m’a semblé moins disponible ; je ne sais pas ce qui se passait de son côté.",
        date: "2026-09-09T19:20:00-03:00",
        personIds: ["claire"],
        category: "impression",
        source: "Journal · scénario de démonstration",
      },
      {
        id: "lea-project",
        title: "Le projet de Léa",
        text: "Léa m’a raconté la fin de son projet au déjeuner. Je lui ai posé quelques questions.",
        date: "2026-09-08T12:40:00-03:00",
        personIds: ["lea"],
        category: "reported",
        source: "Journal · scénario de démonstration",
      },
    ],
  };
}

export function captureNote(
  state: DemoState,
  text: string,
  id: string,
  date: string,
): DemoState {
  if (!text.trim()) return state;
  return {
    ...state,
    revision: state.revision + 1,
    events: [
      {
        id,
        title: text.trim().slice(0, 75),
        text: text.trim(),
        date,
        personIds: [],
        category: "note",
        source: "Saisie locale · non analysée",
      },
      ...state.events,
    ],
  };
}

export function addAnnotation(
  state: DemoState,
  target: Selection,
  text: string,
  id: string,
  date: string,
): DemoState {
  if (!text.trim()) return state;
  return {
    ...state,
    revision: state.revision + 1,
    annotations: [
      ...state.annotations,
      { id, target, text: text.trim(), date },
    ],
  };
}

export function answerQuestion(
  state: DemoState,
  answer: "yes" | "activity" | "unknown",
  date: string,
): DemoState {
  const texts = {
    yes: "Dans cet exemple, Marc a également proposé un café sans lien avec le travail ou le jeu.",
    activity:
      "Dans cet exemple, les initiatives de Marc restent liées au travail ou à une activité partagée.",
    unknown:
      "Je ne sais pas encore si Marc initie en dehors de nos activités partagées.",
  };
  const event: MemoryEvent = {
    id: "question-answer",
    title: "Votre réponse sur l’initiative de Marc",
    text: texts[answer],
    date,
    personIds: ["marc"],
    category: answer === "unknown" ? "note" : "reported",
    source: "Réponse choisie · démonstration",
  };
  return {
    ...state,
    revision: state.revision + 1,
    questionAnswer: answer,
    events: [event, ...state.events.filter((item) => item.id !== event.id)],
  };
}

export function getHypothesis(state: DemoState) {
  const relevant = new Set(["invite", "lunch", "context", "question-answer"]);
  const review = state.annotations.some(
    (a) =>
      (a.target.kind === "hypothesis" && a.target.id === "closeness") ||
      (a.target.kind === "event" && relevant.has(a.target.id)) ||
      (a.target.kind === "person" && a.target.id === "marc"),
  );
  if (review)
    return {
      title: "Le lien avec Marc est à réexaminer",
      short: "Une lecture à nuancer",
      status: "À réexaminer",
      tone: "amber",
      narrative:
        "Vous avez ajouté une nuance. Elle reste attachée aux éléments concernés ; l’interprétation attend une réévaluation.",
      supporting: ["invite", "lunch"],
      against: ["context"],
    };
  if (state.questionAnswer === "activity")
    return {
      title: "Une proximité liée aux activités",
      short: "Un lien autour des activités",
      status: "Portée précisée",
      tone: "sage",
      narrative:
        "Dans ce scénario, le lien se développe autour du travail et du jeu. Votre réponse précise le contexte, sans conclure à une proximité plus générale.",
      supporting: ["invite", "lunch"],
      against: ["context", "question-answer"],
    };
  if (state.questionAnswer === "yes")
    return {
      title: "Le lien dépasse parfois les activités",
      short: "Une proximité qui évolue",
      status: "Un élément en plus",
      tone: "sage",
      narrative:
        "Votre réponse ajoute une initiative hors activité partagée dans le scénario. Elle soutient cette lecture, qui reste une hypothèse.",
      supporting: ["invite", "lunch", "question-answer"],
      against: ["context"],
    };
  return {
    title: "Le lien avec Marc se renforce peut-être",
    short: "Une proximité qui évolue",
    status: "Plausible",
    tone: "sage",
    narrative:
      "Marc prend des initiatives. C’est un signe possible de rapprochement, mais vos activités communes peuvent aussi l’expliquer.",
    supporting: ["invite", "lunch"],
    against: ["context"],
  };
}

export function selectionTitle(selection: Selection, state: DemoState): string {
  if (selection.kind === "person")
    return people.find((p) => p.id === selection.id)?.name ?? "Personne";
  if (selection.kind === "event")
    return (
      state.events.find((e) => e.id === selection.id)?.title ?? "Événement"
    );
  if (selection.kind === "hypothesis")
    return selection.id === "alternative"
      ? "Le rôle des activités partagées"
      : getHypothesis(state).title;
  if (selection.kind === "question")
    return "Une initiative sans activité prévue ?";
  return state.goalText;
}

export function validateDemo(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    typeof v.revision !== "number" ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 1 ||
    typeof v.goalText !== "string" ||
    !v.goalText.trim() ||
    !Array.isArray(v.events) ||
    !Array.isArray(v.annotations)
  )
    return false;
  if (
    v.questionAnswer !== null &&
    v.questionAnswer !== "yes" &&
    v.questionAnswer !== "activity" &&
    v.questionAnswer !== "unknown"
  )
    return false;
  const validEvents = v.events.every(
    (e: MemoryEvent) =>
      e &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      typeof e.text === "string" &&
      typeof e.source === "string" &&
      typeof e.date === "string" &&
      Number.isFinite(Date.parse(e.date)) &&
      Array.isArray(e.personIds) &&
      e.personIds.every((id) => people.some((p) => p.id === id)) &&
      ["reported", "impression", "note"].includes(e.category),
  );
  if (!validEvents) return false;
  const ids = new Set(v.events.map((e: MemoryEvent) => e.id));
  if (
    ids.size !== v.events.length ||
    !createDemo().events.every((e) => ids.has(e.id))
  )
    return false;
  if (v.questionAnswer !== null && !ids.has("question-answer")) return false;
  const validTarget = (s: Selection) =>
    s &&
    ((s.kind === "person" && people.some((p) => p.id === s.id)) ||
      (s.kind === "event" && ids.has(s.id)) ||
      (s.kind === "hypothesis" &&
        ["closeness", "alternative"].includes(s.id)) ||
      (s.kind === "goal" && s.id === "friendship") ||
      (s.kind === "question" && s.id === "initiative"));
  return (
    new Set(v.annotations.map((a: Annotation) => a?.id)).size ===
      v.annotations.length &&
    v.annotations.every(
      (a: Annotation) =>
        a &&
        typeof a.id === "string" &&
        typeof a.text === "string" &&
        typeof a.date === "string" &&
        Number.isFinite(Date.parse(a.date)) &&
        validTarget(a.target),
    )
  );
}
