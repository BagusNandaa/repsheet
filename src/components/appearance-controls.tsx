"use client";

import { useRef } from "react";
import { cn } from "cn";
import { useTheme } from "@/components/theme-provider";
import type { Accent, ThemeMode } from "@/lib/theme";

const themes: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const accents: Array<{ value: Accent; label: string; swatch: string }> = [
  { value: "rust", label: "Rust", swatch: "#9a3e22" },
  { value: "green", label: "Green", swatch: "#32d74b" },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  optionClass,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; swatch?: string }>;
  onChange: (value: T) => void;
  optionClass: string;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function move(from: number, direction: number) {
    const next = (from + direction + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-full bg-muted p-0.5"
      onKeyDown={(event) => {
        const index = options.findIndex((option) => option.value === value);
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(index, 1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(index, -1);
        }
      }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              optionClass,
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground",
            )}
          >
            {option.swatch ? (
              <span
                className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/25"
                style={{ backgroundColor: option.swatch }}
                aria-hidden
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function AppearanceControls() {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Segmented
        label="Theme"
        value={mode}
        options={themes}
        onChange={setMode}
        optionClass="theme-option"
      />
      <Segmented
        label="Accent"
        value={accent}
        options={accents}
        onChange={setAccent}
        optionClass="accent-option"
      />
    </div>
  );
}
