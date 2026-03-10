"use client";

import type { ThemeMode } from "@/lib/types";

type Props = {
  themeMode: ThemeMode;
  onToggle: () => void;
  compact?: boolean;
};

export function ThemeToggle({ themeMode, onToggle, compact = false }: Props) {
  const dark = themeMode === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={dark}
      className={`inline-flex items-center rounded-full border border-emerald-900/15 bg-white/75 px-2 py-2 text-sm font-medium text-ink shadow-[0_10px_25px_rgba(0,0,0,0.08)] backdrop-blur transition hover:border-accent/40 hover:bg-white ${compact ? "" : ""}`}
    >
      <span
        className={`relative flex h-7 w-12 items-center rounded-full transition ${dark ? "bg-slate-800" : "bg-amber-200"}`}
      >
        <span
          className={`absolute flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] shadow-sm transition ${dark ? "translate-x-6" : "translate-x-1"}`}
        >
          {dark ? "☾" : "☀"}
        </span>
      </span>
    </button>
  );
}
