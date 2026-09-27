import { useCallback, useMemo } from "react";
import { useSync, useSyncVersion } from "./sync/SyncProvider";
import { cleanSlateValue, DEFAULT_SLATE, stepTake, type SlateField } from "./slate";

/** The project's clapboard, shared with everyone on the project. */
export function useSlate(projectId: string) {
  const { engine } = useSync();
  const version = useSyncVersion();
  const row = useMemo(() => engine.get("slates", projectId), [engine, version, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(
    (field: SlateField, raw: string) => {
      const value = cleanSlateValue(field, raw);
      const cur = engine.get("slates", projectId);
      if (cur) {
        if (cur[field] !== value) engine.patch("slates", projectId, { [field]: value });
      } else {
        engine.put("slates", { id: projectId, projectId, ...DEFAULT_SLATE, [field]: value });
      }
    },
    [engine, projectId],
  );

  const step = useCallback(
    (by: 1 | -1) => set("take", stepTake(engine.get("slates", projectId)?.take ?? DEFAULT_SLATE.take, by)),
    [engine, projectId, set],
  );

  return { row, set, step };
}
