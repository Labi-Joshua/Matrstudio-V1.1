"use client";

import { type ReactNode, useEffect, useReducer, useRef } from "react";
import { GATE_IDLE, type Gate, gateStep } from "../../lib/app/paths-state";

/**
 * True once `pending` has lasted about 150 ms, and for at least about 300 ms after it first
 * showed, so a fast response never flashes a skeleton and a slow one never blinks away.
 */
export function useSkeletonGate(pending: boolean): boolean {
  const gate = useRef<Gate>(GATE_IDLE);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const step = gateStep(gate.current, pending, Date.now());
  gate.current = step.gate;
  const { wakeIn } = step;
  useEffect(() => {
    if (wakeIn === null) return;
    const timer = setTimeout(tick, wakeIn);
    return () => clearTimeout(timer);
  }, [wakeIn]);
  return step.show;
}

/**
 * Suspense fallbacks mount only while something is pending, so this only delays them (the minimum
 * stay cannot apply once React unmounts the fallback).
 */
export function DelayedFallback({ children }: { children: ReactNode }) {
  return useSkeletonGate(true) ? children : null;
}
