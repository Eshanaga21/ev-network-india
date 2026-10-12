import { Moon, Sun } from "lucide-react";
import { create } from "zustand";

export type Theme = "light" | "dark";
function initialTheme(): Theme {
  try {
    return localStorage.getItem("ev-network-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
export const useTheme = create<{ theme: Theme; toggle: () => void }>((set) => ({
  theme: initialTheme(),
  toggle: () =>
    set((state) => {
      const theme = state.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("ev-network-theme", theme);
      } catch {
        /* Keep the session choice if storage is unavailable. */
      }
      return { theme };
    }),
}));
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
