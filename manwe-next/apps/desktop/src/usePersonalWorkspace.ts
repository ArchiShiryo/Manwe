import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnnotationCommand,
  AnnotationType,
  CaptureCommand,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import { MemoryApiError, memoryApi, type MemoryStatus } from "./memoryApi.ts";

/** Intervalle de vérification de la révision (R4.7). */
export const SYNC_INTERVAL_MS = 4000;

export type PersonalStatus = "connecting" | "ready" | "saving" | "error";
export type { ConnectionState } from "./syncLabels.ts";
import type { ConnectionState } from "./syncLabels.ts";

export function usePersonalWorkspace(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [status, setStatus] = useState<PersonalStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  const [connection, setConnection] = useState<ConnectionState>("online");
  const [remote, setRemote] = useState<MemoryStatus | null>(null);
  const [resyncedAt, setResyncedAt] = useState<number | null>(null);
  const revisionRef = useRef<number | null>(null);
  revisionRef.current = snapshot?.workspace.revision ?? null;

  const load = useCallback(async () => {
    if (!enabled) return;
    setStatus("connecting");
    try {
      setSnapshot(await memoryApi.snapshot());
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setStatus("error");
      setError(
        cause instanceof MemoryApiError
          ? cause.message
          : "Impossible d’ouvrir la mémoire locale.",
      );
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  // Resynchronisation (R4.7) : on compare la révision du service à celle
  // affichée ; un écart (autre onglet, analyse appliquée ailleurs, service
  // relancé) recharge l'instantané complet, sans rien fusionner à la main.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let lost = false;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await memoryApi.status();
        if (!alive) return;
        setRemote(next);
        setConnection("online");
        if (lost || next.revision !== revisionRef.current) {
          const fresh = await memoryApi.snapshot();
          if (!alive) return;
          setSnapshot(fresh);
          setStatus("ready");
          setError(null);
          if (lost) setResyncedAt(Date.now());
        }
        lost = false;
      } catch {
        if (!alive) return;
        lost = true;
        setConnection("reconnecting");
      }
    };
    const timer = window.setInterval(() => void check(), SYNC_INTERVAL_MS);
    const now = () => void check();
    window.addEventListener("focus", now);
    window.addEventListener("online", now);
    document.addEventListener("visibilitychange", now);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", now);
      window.removeEventListener("online", now);
      document.removeEventListener("visibilitychange", now);
    };
  }, [enabled]);

  const perform = async (operation: () => Promise<WorkspaceSnapshot>) => {
    setStatus("saving");
    try {
      const next = await operation();
      setSnapshot(next);
      setStatus("ready");
      setError(null);
      return next;
    } catch (cause) {
      setStatus("error");
      setError(
        cause instanceof MemoryApiError
          ? cause.message
          : "La mémoire locale n’a pas pu être modifiée.",
      );
      throw cause;
    }
  };

  return {
    snapshot,
    status,
    error,
    connection,
    remote,
    resyncedAt,
    reload: load,
    capture: (input: string | Omit<CaptureCommand, "idempotencyKey">) =>
      perform(() =>
        memoryApi.capture({
          idempotencyKey: `capture:${crypto.randomUUID()}`,
          ...(typeof input === "string" ? { text: input } : input),
        }),
      ),
    annotate: (
      target: AnnotationCommand["target"],
      text: string,
      annotationType: AnnotationType,
    ) =>
      perform(() =>
        memoryApi.annotate({
          idempotencyKey: `annotate:${crypto.randomUUID()}`,
          target,
          text,
          annotationType,
        }),
      ),
    updateGoal: (text: string, goalId?: string) =>
      perform(() =>
        memoryApi.updateGoal({
          idempotencyKey: `goal:${crypto.randomUUID()}`,
          goalId,
          text,
        }),
      ),
  };
}
