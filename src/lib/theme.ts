export const THEME_STORAGE_KEY = "repsheet.theme";
export const ACCENT_STORAGE_KEY = "repsheet.accent";

export type ThemeMode = "system" | "light" | "dark";
export type Accent = "rust" | "green";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function isAccent(value: string | null): value is Accent {
  return value === "rust" || value === "green";
}

export function isDarkMode(mode: ThemeMode, systemDark: boolean) {
  return mode === "dark" || (mode === "system" && systemDark);
}

export function readThemePreference(): { mode: ThemeMode; accent: Accent } {
  try {
    const mode = localStorage.getItem(THEME_STORAGE_KEY);
    const accent = localStorage.getItem(ACCENT_STORAGE_KEY);
    return {
      mode: isThemeMode(mode) ? mode : "system",
      accent: isAccent(accent) ? accent : "rust",
    };
  } catch {
    return { mode: "system", accent: "rust" };
  }
}

export function applyTheme(mode: ThemeMode, accent: Accent) {
  const dark = isDarkMode(mode, window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.accent = accent;
  root.dataset.theme = mode;
  root.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#000000" : "#f3efe6");
}

export function persistTheme(mode: ThemeMode, accent: Accent) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Private browsing can block storage. The choice still applies for this view.
  }
  applyTheme(mode, accent);
}

/** Runs before paint. Kept in sync with applyTheme; storage is not repsheet.v1. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(t!=="light"&&t!=="dark"&&t!=="system")t="system";if(a!=="rust"&&a!=="green")a="rust";var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.dataset.accent=a;root.dataset.theme=t;root.style.colorScheme=dark?"dark":"light";var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",dark?"#000000":"#f3efe6");}catch(e){}})();`;
