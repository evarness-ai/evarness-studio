// Triple-track theming: CSS defaults follow prefers-color-scheme; an explicit
// user choice stamps data-theme on <html> and wins in both directions.
// Persisted in localStorage; "auto" clears the override.

export type Theme = "auto" | "dark" | "light";
const KEY = "evarness-studio:theme";

export function currentTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  return saved === "dark" || saved === "light" ? saved : "auto";
}

export function applyTheme(theme: Theme): void {
  if (theme === "auto") {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(KEY);
  } else {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }
}

const LABELS: Record<Theme, string> = {
  auto: "◐ Theme: auto",
  dark: "● Theme: dark",
  light: "○ Theme: light",
};

/** A cycling toggle button: auto → dark → light → auto. */
export function themeToggle(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "themetoggle";
  let theme = currentTheme();
  const draw = () => (btn.textContent = LABELS[theme]);
  btn.addEventListener("click", () => {
    theme = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
    applyTheme(theme);
    draw();
  });
  applyTheme(theme);
  draw();
  return btn;
}
