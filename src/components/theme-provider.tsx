"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyTheme,
  persistTheme,
  readThemePreference,
  type Accent,
  type ThemeMode,
} from "@/lib/theme";

type Preference = { mode: ThemeMode; accent: Accent };

type ThemeContextValue = Preference & {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
};

const serverPreference: Preference = { mode: "system", accent: "rust" };
let current: Preference = serverPreference;
const listeners = new Set<() => void>();
const ThemeContext = createContext<ThemeContextValue | null>(null);

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return serverPreference;
}

function commitPreference(next: Preference) {
  current = next;
  persistTheme(next.mode, next.accent);
  emit();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    const stored = readThemePreference();
    current = stored;
    applyTheme(stored.mode, stored.accent);
    emit();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => applyTheme(current.mode, current.accent);
    const onStorage = () => {
      const next = readThemePreference();
      current = next;
      applyTheme(next.mode, next.accent);
      emit();
    };
    media.addEventListener("change", onMedia);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    commitPreference({ mode, accent: getSnapshot().accent });
  }, []);

  const setAccent = useCallback((accent: Accent) => {
    commitPreference({ mode: getSnapshot().mode, accent });
  }, []);

  const value = useMemo(
    () => ({ mode: preference.mode, accent: preference.accent, setMode, setAccent }),
    [preference, setMode, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
