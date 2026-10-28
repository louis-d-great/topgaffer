"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useLocal } from "@/lib/store";

export type Theme = "dark" | "light";

/** Switches the whole app (and BoardUI components) between the dark and light themes. */
export function ThemeToggle() {
  const [theme, setTheme] = useLocal<Theme>("tg.theme", "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      onClick={() => setTheme(next)}
      className="grid size-9 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-text"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon size={16} />
    </button>
  );
}
