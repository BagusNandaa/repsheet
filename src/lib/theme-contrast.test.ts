import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "./contrast.ts";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_THEME_MODE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isAccent,
  isDarkMode,
  isThemeMode,
  readThemePreference,
} from "./theme.ts";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/globals.css"),
  "utf8",
);

const darkSurfaces = ["#000000", "#141414"] as const;

test("dark body text and accent text clear WCAG AA on every dark panel", () => {
  const foregrounds = ["#f5f5f7", "#a1a1a6", "#d4785c", "#32d74b", "#ff6b5a"];
  for (const foreground of foregrounds) {
    for (const background of darkSurfaces) {
      const ratio = contrastRatio(foreground, background);
      assert.ok(ratio >= 4.5, `${foreground} on ${background} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("rust fill stays #9a3e22 and is not used as dark text", () => {
  assert.ok(contrastRatio("#9a3e22", "#000000") < 4.5);
  assert.ok(contrastRatio("#9a3e22", "#17181b") < 3);
  assert.ok(contrastRatio("#fffaf3", "#9a3e22") >= 4.5);
  assert.match(css, /--brand-fill:\s*#9a3e22/);
  assert.match(css, /--brand-text:\s*#d4785c/);
  assert.match(css, /--brand-ink:\s*#fffaf3/);
});

test("green accent ink and light-paper text clear AA", () => {
  assert.ok(contrastRatio("#04150a", "#32d74b") >= 4.5);
  assert.ok(contrastRatio("#32d74b", "#f3efe6") < 4.5);
  for (const paper of ["#f3efe6", "#fffdf8", "#efe8da", "#e4dccb"]) {
    const ratio = contrastRatio("#166324", paper);
    assert.ok(ratio >= 4.5, `#166324 on ${paper} is ${ratio.toFixed(2)}:1`);
  }
  assert.match(css, /#32d74b/);
  assert.match(css, /#04150a/);
  assert.match(css, /#166324/);
  assert.match(css, /rgba\(50,\s*215,\s*75,\s*0\.13\)/);
});

test("#7d7d85 fails on the raised panel, so it is not a text token", () => {
  assert.ok(contrastRatio("#7d7d85", "#17181b") < 4.5);
  assert.ok(contrastRatio("#a1a1a6", "#17181b") >= 4.5);
  assert.doesNotMatch(css, /--[\w-]*:\s*#7d7d85/i);
  assert.match(css, /--muted-foreground:\s*#a1a1a6/);
});

test("dark theme tokens and paper theme tokens are both present", () => {
  assert.match(css, /--background:\s*#000000/);
  assert.match(css, /--card:\s*#000000/);
  assert.match(css, /--muted:\s*#141414/);
  assert.match(css, /--foreground:\s*#f5f5f7/);
  assert.match(css, /--primary:\s*#f5f5f7/);
  assert.match(css, /--border:\s*rgba\(255,\s*255,\s*255,\s*0\.18\)/);
  assert.match(css, /--hair-soft:\s*rgba\(255,\s*255,\s*255,\s*0\.08\)/);
  assert.match(css, /--background:\s*#f3efe6/);
  assert.match(css, /--primary:\s*#9a3e22/);
  assert.match(css, /--card:\s*#fffdf8/);
  assert.match(css, /--desk:\s*#e4dccb/);
  assert.match(css, /--desk:\s*#000000/);
  assert.match(css, /--font-sans:\s*var\(--font-outfit\)/);
  assert.match(css, /--font-display:\s*var\(--font-fraunces\)/);
  assert.match(css, /var\(--font-space-mono\)/);
  assert.match(css, /var\(--font-doto\)/);
  assert.match(css, /radial-gradient\(circle/);
  assert.match(css, /cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /border-radius:\s*0/);
  assert.match(css, /outline:\s*2px solid var\(--brand-text\)/);
  assert.match(css, /safe-area-inset-left/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.doesNotMatch(css, /fonts\.gstatic\.com/);
});

test("missing preference resolves to dark and green, outside the data store", () => {
  assert.equal(DEFAULT_THEME_MODE, "dark");
  assert.equal(DEFAULT_ACCENT, "green");
  assert.equal(isDarkMode("system", true), true);
  assert.equal(isDarkMode("system", false), false);
  assert.equal(isDarkMode("light", true), false);
  assert.equal(isDarkMode("dark", false), true);
  assert.equal(isThemeMode("system"), true);
  assert.equal(isThemeMode("light"), true);
  assert.equal(isThemeMode("sepia"), false);
  assert.equal(isAccent("rust"), true);
  assert.equal(isAccent("green"), true);
  assert.equal(isAccent("blue"), false);
  assert.equal(THEME_STORAGE_KEY, "repsheet.theme");
  assert.equal(ACCENT_STORAGE_KEY, "repsheet.accent");
  assert.equal(THEME_INIT_SCRIPT.includes("repsheet.v1"), false);
  assert.equal(THEME_INIT_SCRIPT.includes(THEME_STORAGE_KEY), true);
  assert.equal(THEME_INIT_SCRIPT.includes(ACCENT_STORAGE_KEY), true);
  assert.match(THEME_INIT_SCRIPT, /t!=="light"&&t!=="dark"&&t!=="system"\)t="dark"/);
  assert.match(THEME_INIT_SCRIPT, /a!=="rust"&&a!=="green"\)a="green"/);
  const storage = {
    getItem: (key: string) => {
      if (key === THEME_STORAGE_KEY) return stored.mode;
      if (key === ACCENT_STORAGE_KEY) return stored.accent;
      return null;
    },
  };
  const stored: { mode: string | null; accent: string | null } = { mode: null, accent: null };
  const previous = globalThis.localStorage;
  globalThis.localStorage = storage as unknown as Storage;
  try {
    assert.deepEqual(readThemePreference(), { mode: "dark", accent: "green" });
    stored.mode = "system";
    stored.accent = "rust";
    assert.deepEqual(readThemePreference(), { mode: "system", accent: "rust" });
    stored.mode = "light";
    stored.accent = "green";
    assert.deepEqual(readThemePreference(), { mode: "light", accent: "green" });
  } finally {
    if (previous === undefined) {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      globalThis.localStorage = previous;
    }
  }
});
