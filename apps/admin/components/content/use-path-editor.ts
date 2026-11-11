"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patchPath } from "../../lib/content/api";
import { toPatchModules } from "../../lib/content/reorder";
import type { PathDoc, PathPatch } from "../../lib/content/types";

export type SaveState = "saved" | "dirty" | "saving" | "error";
export const AUTOSAVE_MS = 800;
export const isTemp = (id: string) => id.startsWith("tmp-");

export function patchFromDoc(doc: PathDoc): PathPatch {
  return {
    title: doc.title,
    description: doc.description,
    level: doc.level,
    topic: doc.topic,
    time: doc.time,
    showInExplore: doc.showInExplore,
    certificate: doc.certificate,
    inviteOnly: doc.inviteOnly,
    modules: toPatchModules(doc.modules),
  };
}

/**
 * Local copy of a path with save handling. Draft paths autosave 800 ms after the last edit; live
 * paths wait for `save()` (the "Save changes" button). A failed save keeps the edits, reports
 * "error" and can be retried. New modules get a "tmp-" id until the server answers with real ones.
 */
export function usePathEditor(initial: PathDoc, onSaveError: (message: string) => void) {
  const [doc, setDoc] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const docRef = useRef(doc);
  docRef.current = doc;
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef = useRef(onSaveError);
  errorRef.current = onSaveError;
  const autosave = initial.status !== "live";

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    const sent = version.current;
    setSaveState("saving");
    const result = await patchPath(docRef.current.id, patchFromDoc(docRef.current));
    if (!result.ok) {
      setSaveState("error");
      errorRef.current(result.message);
      return false;
    }
    const server = result.data;
    if (version.current === sent) {
      setDoc((d) => ({
        ...d,
        lastSavedAt: server.lastSavedAt,
        modules: server.modules.length === d.modules.length ? mergeIds(d, server) : d.modules,
      }));
      setSaveState("saved");
    } else {
      setSaveState("dirty");
    }
    return true;
  }, []);

  const edit = useCallback(
    (change: (doc: PathDoc) => PathDoc) => {
      version.current++;
      setDoc(change);
      setSaveState("dirty");
      if (autosave) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
      }
    },
    [autosave, save],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  /** Replace the whole document with the server's (after add lessons, publish, remove lesson). */
  const replace = useCallback((next: PathDoc) => {
    version.current++;
    setDoc(next);
    setSaveState("saved");
  }, []);

  /** Change the local copy without marking it unsaved (the server already has it). */
  const local = useCallback((change: (doc: PathDoc) => PathDoc) => setDoc(change), []);

  return { doc, saveState, edit, save, replace, local, autosave };
}

/** Keeps local lesson text, takes server ids for modules created with a temporary id. */
function mergeIds(local: PathDoc, server: PathDoc) {
  return local.modules.map((m, i) => {
    const s = server.modules[i];
    return s && isTemp(m.id) ? { ...m, id: s.id } : m;
  });
}
