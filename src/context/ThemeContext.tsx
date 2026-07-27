"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Dark mode is intentionally disabled per user request
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.remove("dark");
  }, [theme, mounted]);

  const toggleTheme = () => {
    // Disabled
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {!mounted ? <div className="invisible">{children}</div> : children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
