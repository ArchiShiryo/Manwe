// Préférence d'animation du fond génératif. Par défaut, on suit le système
// (« réduire les animations » fige le fond) ; l'utilisateur peut forcer
// l'animation ou l'image fixe, et son choix est mémorisé sur ce poste.
import { useEffect, useState } from "react";

export type FieldMotionPreference = "animated" | "still" | null;

const KEY = "manwe.fieldMotion";
const EVENT = "manwe:field-motion";

export function readFieldMotion(): FieldMotionPreference {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "animated" || value === "still" ? value : null;
  } catch {
    return null;
  }
}

export function systemPrefersReducedMotion() {
  return Boolean(
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
}

export function isFieldAnimated(preference = readFieldMotion()) {
  if (preference) return preference === "animated";
  return !systemPrefersReducedMotion();
}

export function useFieldMotion() {
  const [animated, setAnimated] = useState(() => isFieldAnimated());
  useEffect(() => {
    const refresh = () => setAnimated(isFieldAnimated());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const choose = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? "animated" : "still");
    } catch {
      // stockage indisponible : le choix vaut pour cette session seulement
    }
    setAnimated(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return { animated, choose };
}
