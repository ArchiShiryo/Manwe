import { useEffect, useState } from "react";
import {
  createDemo,
  validateDemo,
  type DemoState,
} from "../../../packages/domain/src/demo.ts";

// QA runs use an isolated demo so browser tests never alter the delivered space.
const STORAGE_KEY =
  new URLSearchParams(window.location.search).get("qa") === "1"
    ? "manwe-next:qa:v1"
    : "manwe-next:ui-demo:v1";
export function useWorkspace() {
  const [loaded] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (validateDemo(parsed))
            return { state: parsed, preserveOriginal: false };
        } catch {
          /* Preserve unreadable data instead of replacing it. */
        }
        return { state: createDemo(), preserveOriginal: true };
      }
    } catch {
      /* The demo remains usable in memory. */
    }
    return { state: createDemo(), preserveOriginal: false };
  });
  const [state, setState] = useState<DemoState>(loaded.state);
  const [warning, setWarning] = useState(loaded.preserveOriginal);
  useEffect(() => {
    if (loaded.preserveOriginal) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setWarning(false);
    } catch {
      setWarning(true);
    }
  }, [state, loaded]);
  return { state, setState, warning };
}
