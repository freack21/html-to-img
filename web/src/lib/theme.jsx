import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Keep in sync with the inline boot script in index.html (applies the class before first paint).
const STORAGE_KEY = "theme";
const THEMES = ["light", "dark", "system"];
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

function apply(theme) {
  const dark = theme === "dark" || (theme === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

const ThemeContext = createContext(null);

/** Light / dark / system theme, persisted per browser. */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [resolved, setResolved] = useState(() => (apply(readStored()) ? "dark" : "light"));

  useEffect(() => {
    setResolved(apply(theme) ? "dark" : "light");
    if (theme !== "system") return undefined;
    const query = media();
    const onChange = () => setResolved(apply("system") ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page view only.
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
