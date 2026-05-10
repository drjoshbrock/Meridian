const DRAFT_KEY = "meridian:draft";
const THEME_KEY = "meridian:theme";

export function saveDraft(text) {
  try { localStorage.setItem(DRAFT_KEY, text); } catch {}
}

export function loadDraft() {
  try { return localStorage.getItem(DRAFT_KEY) || ""; } catch { return ""; }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
  } catch {}
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}
