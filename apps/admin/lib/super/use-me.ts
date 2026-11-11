"use client";

import { getMe } from "./api";
import { useLoader } from "./hooks";
import type { Level, MeInfo } from "./types";

/** The signed-in admin (GET /api/admin/me). Local until the shell's lib/session exists. */
export function useMe() {
  const { state } = useLoader(getMe, []);
  return state.status === "ready" ? state.data : null;
}

export const levelRank = (level: Level) => (level === "manage" ? 2 : level === "view" ? 1 : 0);

export const can = (me: MeInfo | null, area: keyof MeInfo["permissions"], level: Level) =>
  me !== null && levelRank(me.permissions[area]) >= levelRank(level);
