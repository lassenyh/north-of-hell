"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import "./storyboard-theme.css";

type Theme = "light" | "dark";
const storageKey = "storyboard-theme";
const changeEvent = "storyboard-theme-change";
let fallbackTheme: Theme = "light";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

function currentTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === "dark" || stored === "light" ? stored : fallbackTheme;
  }
  catch { return fallbackTheme; }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}

export function StoryboardTheme({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "light");

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    fallbackTheme = next;
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the current page usable. */ }
    window.dispatchEvent(new Event(changeEvent));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>
    <div className={`storyboard-theme storyboard-theme--${theme}`}>{children}</div>
  </ThemeContext.Provider>;
}

export function useStoryboardTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Storyboard theme provider is missing");
  return context;
}
