"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createAvatarStore, PROFILE_CHANGE_EVENT } from "../../lib/app/avatar-store";
import { getOwnProfile } from "../../lib/auth/profile-api";

const store = createAvatarStore(async () => {
  const result = await getOwnProfile();
  return result.ok ? result.data.avatarUrl : null;
});

let listening = false;
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(PROFILE_CHANGE_EVENT, store.refresh);
}

const SERVER = { owner: null, url: null };

/** The learner's photo URL (same-origin /api/avatars/...), or null: no photo, still loading, or failed. */
export function useAvatarUrl(owner: string): string | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER);
  useEffect(() => {
    listen();
    store.load(owner);
  }, [owner]);
  return snapshot.owner === owner ? snapshot.url : null;
}
