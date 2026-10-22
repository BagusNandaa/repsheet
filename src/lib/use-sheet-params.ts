"use client";

import { useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { STATIC_PARAM, readSheetParams, type SheetParams } from "@/lib/static-params";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function ensureHistoryPatch() {
  const flag = "__repsheetHistory";
  const historyWithFlag = history as History & { [flag]?: boolean };
  if (historyWithFlag[flag]) return;
  historyWithFlag[flag] = true;
  const { pushState, replaceState } = history;
  history.pushState = function (...args: Parameters<History["pushState"]>) {
    const result = pushState.apply(this, args);
    notify();
    return result;
  };
  history.replaceState = function (...args: Parameters<History["replaceState"]>) {
    const result = replaceState.apply(this, args);
    notify();
    return result;
  };
}

function subscribe(listener: () => void) {
  ensureHistoryPatch();
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function browserPath() {
  return window.location.pathname;
}

function serverPath() {
  return "";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function useSheetParams(): SheetParams {
  const params = useParams<{ id?: string; exerciseId?: string }>();
  const path = useSyncExternalStore(subscribe, browserPath, serverPath);
  if (path) return readSheetParams(path);

  const id = one(params.id);
  const exerciseId = one(params.exerciseId);
  return {
    id: id === STATIC_PARAM ? undefined : id,
    exerciseId: exerciseId === STATIC_PARAM ? undefined : exerciseId,
  };
}
