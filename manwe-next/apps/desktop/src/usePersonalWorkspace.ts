import { useCallback, useEffect, useState } from "react";
import type {
  AnnotationCommand,
  AnnotationType,
  CaptureCommand,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import { MemoryApiError, memoryApi } from "./memoryApi.ts";

export type PersonalStatus = "connecting" | "ready" | "saving" | "error";

export function usePersonalWorkspace(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [status, setStatus] = useState<PersonalStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

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
