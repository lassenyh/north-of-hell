"use client";

import { createContext, useContext, type ReactNode } from "react";
import "./storyboard-theme.css";

type Theme = "dark";
const ThemeContext = createContext<{ theme: Theme } | null>(null);
const darkTheme = { theme: "dark" as const };

export function StoryboardTheme({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={darkTheme}>
    <div className="storyboard-theme storyboard-theme--dark">{children}</div>
  </ThemeContext.Provider>;
}

export function useStoryboardTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Storyboard theme provider is missing");
  return context;
}
