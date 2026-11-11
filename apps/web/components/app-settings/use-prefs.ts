"use client";

import { useCallback } from "react";
import {
  applyPrefsPatch,
  inversePatch,
  savedToast,
  saveFailureToast,
} from "../../lib/app/settings-state";
import { getPrefs, type Prefs, type PrefsPatch, patchPrefs } from "../../lib/auth/prefs-api";
import { useSettingsToast } from "./toast";
import { useLoaded } from "./use-loaded";

/**
 * Preferences with optimistic saves: the control changes at once, the PATCH follows, and if the
 * API refuses the control goes back to what it was and a toast says so.
 */
export function usePrefs() {
  const { state, reload, set } = useLoaded(getPrefs);
  const toast = useSettingsToast();

  const update = useCallback(
    async (patch: PrefsPatch, before: Prefs) => {
      set((current) => applyPrefsPatch(current, patch));
      const result = await patchPrefs(patch);
      if (result.ok) {
        set(() => result.data);
        toast(savedToast());
        return;
      }
      set((current) => applyPrefsPatch(current, inversePatch(before, patch)));
      toast(saveFailureToast(result));
    },
    [set, toast],
  );

  return { state, reload, update };
}
