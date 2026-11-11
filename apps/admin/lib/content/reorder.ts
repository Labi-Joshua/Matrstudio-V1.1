import type { Lesson, Module } from "./types";

export type Position = { moduleIndex: number; index: number };

export function findLesson(modules: Module[], lessonId: string): Position | undefined {
  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
    const index = modules[moduleIndex]?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
    if (index >= 0) return { moduleIndex, index };
  }
  return undefined;
}

/** Moves a lesson so it sits at `toIndex` of module `toModule` (index in the list without it). */
export function moveLesson(
  modules: Module[],
  lessonId: string,
  toModule: number,
  toIndex: number,
): Module[] {
  const from = findLesson(modules, lessonId);
  if (!from || toModule < 0 || toModule >= modules.length) return modules;
  const lesson = modules[from.moduleIndex]?.lessons[from.index] as Lesson;
  const next = modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }));
  const target = next[toModule] as Module;
  const at = Math.max(0, Math.min(toIndex, target.lessons.length));
  target.lessons.splice(at, 0, lesson);
  return next;
}

/** One step up or down; crosses into the neighbouring module at the edges. */
export function stepLesson(modules: Module[], lessonId: string, dir: -1 | 1): Module[] {
  const pos = findLesson(modules, lessonId);
  if (!pos) return modules;
  const current = modules[pos.moduleIndex] as Module;
  const target = pos.index + dir;
  if (target >= 0 && target < current.lessons.length)
    return moveLesson(modules, lessonId, pos.moduleIndex, target);
  const neighbour = pos.moduleIndex + dir;
  if (neighbour < 0 || neighbour >= modules.length) return modules;
  const into = modules[neighbour] as Module;
  return moveLesson(modules, lessonId, neighbour, dir === -1 ? into.lessons.length : 0);
}

export function stepModule(modules: Module[], moduleId: string, dir: -1 | 1): Module[] {
  const i = modules.findIndex((m) => m.id === moduleId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= modules.length) return modules;
  const next = [...modules];
  [next[i], next[j]] = [next[j] as Module, next[i] as Module];
  return next;
}

/** Position of a lesson across the whole path, 1-based. */
export function lessonNumber(modules: Module[], lessonId: string): number {
  let n = 0;
  for (const m of modules)
    for (const l of m.lessons) {
      n++;
      if (l.id === lessonId) return n;
    }
  return 0;
}

export const countLessons = (modules: Module[]) =>
  modules.reduce((n, m) => n + m.lessons.length, 0);
export const lessonsNeedingIntro = (modules: Module[]) =>
  modules.reduce((n, m) => n + m.lessons.filter((l) => !l.intro.trim()).length, 0);

export const toPatchModules = (modules: Module[]) =>
  modules.map((m) => ({ id: m.id, title: m.title, lessonIds: m.lessons.map((l) => l.id) }));
