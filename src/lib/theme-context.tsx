"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";

const STORAGE_KEY = "picpop_theme";

/** Routes that must always be dark (no theme toggle) */
const DARK_ONLY_ROUTES = ["/login"];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  isDarkOnlyRoute: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const isDarkOnlyRoute = typeof pathname === "string" && DARK_ONLY_ROUTES.includes(pathname);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
    } else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      setThemeState("light");
    }
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === "undefined") return;
    const effectiveTheme = isDarkOnlyRoute ? "dark" : theme;
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
    document.documentElement.classList.toggle("light", effectiveTheme === "light");
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    if (!isDarkOnlyRoute) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme, mounted, isDarkOnlyRoute]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDarkOnlyRoute }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
