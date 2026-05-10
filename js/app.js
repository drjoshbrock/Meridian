import { createEditor, setDoc, getDoc } from "./editor.js";
import { render, setRendererTheme } from "./renderer.js";
import { openFile, saveToHandle, saveAs, hasFileSystemAccess } from "./files.js";
import { saveDraft, loadDraft, loadTheme, saveTheme } from "./storage.js";
import { renderOutline } from "./outline.js";

const DEFAULT_DOC = `# Welcome to Meridian

A fast, clean markdown editor and previewer — a PWA inspired by [Clearly](https://clearly.md/).

## What it does

- **Live preview** alongside your editor
- *Syntax highlighting* in the editor and in fenced code blocks
- GitHub Flavored Markdown — tables, task lists, strikethrough
- KaTeX math, inline like $E = mc^2$ and block:

$$
\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

- Mermaid diagrams
- Document outline, dark mode, PDF export (Print)
- Works **offline** — install it from your browser

## Code

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Diagram

\`\`\`mermaid
graph LR
  A[Write] --> B[Preview]
  B --> C[Export PDF]
\`\`\`

## Tasks

- [x] Open or create a file
- [ ] Edit your notes
- [ ] Save (Ctrl/Cmd+S)

## Shortcuts

| Action          | Shortcut          |
|-----------------|-------------------|
| Bold            | Ctrl/Cmd + B      |
| Italic          | Ctrl/Cmd + I      |
| Inline code     | Ctrl/Cmd + \`     |
| Link            | Ctrl/Cmd + K      |
| Toggle task     | Ctrl/Cmd + Shift+X|
| New             | Ctrl/Cmd + N      |
| Open            | Ctrl/Cmd + O      |
| Save            | Ctrl/Cmd + S      |
| Save As         | Shift+Ctrl/Cmd+S  |
| Find            | Ctrl/Cmd + F      |
| Print / PDF     | Ctrl/Cmd + P      |
`;

const state = {
  view: null,
  handle: null,
  name: "Untitled.md",
  dirty: false,
  theme: "light",
  lastSavedText: ""
};

function $(id) { return document.getElementById(id); }

function init() {
  state.theme = loadTheme();
  applyTheme(state.theme);

  const draft = loadDraft();
  const initialDoc = draft || DEFAULT_DOC;
  state.lastSavedText = initialDoc;

  state.view = createEditor($("editor"), {
    initialDoc,
    onChange: (text) => {
      saveDraft(text);
      setDirty(text !== state.lastSavedText);
      schedulePreview();
    }
  });

  renderPreview();
  bindToolbar();
  bindShortcuts();
  registerServiceWorker();
  handleLaunchQueue();
}

let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 150);
}

async function renderPreview() {
  const text = getDoc(state.view);
  const headings = await render(text, $("preview"), state.theme);
  renderOutline($("outline-list"), headings, (h) => {
    document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setDirty(dirty) {
  state.dirty = dirty;
  $("dirty-indicator").hidden = !dirty;
}

function setName(name) {
  state.name = name;
  $("doc-title").textContent = name;
}

function bindToolbar() {
  $("btn-new").onclick = newDoc;
  $("btn-open").onclick = open;
  $("btn-save").onclick = save;
  $("btn-save-as").onclick = saveAsCmd;
  $("btn-print").onclick = () => window.print();
  $("btn-outline").onclick = toggleOutline;
  $("btn-theme").onclick = toggleTheme;
  for (const btn of document.querySelectorAll(".mode-btn")) {
    btn.onclick = () => setMode(btn.dataset.mode);
  }
  if (!hasFileSystemAccess()) {
    $("btn-save").title = "Save (downloads a file)";
  }
}

function setMode(mode) {
  document.querySelector(".workspace").dataset.mode = mode;
  for (const btn of document.querySelectorAll(".mode-btn")) {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  }
}

function toggleOutline() {
  const aside = document.querySelector(".outline");
  aside.hidden = !aside.hidden;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("hljs-light").disabled = theme === "dark";
  $("hljs-dark").disabled = theme !== "dark";
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#1a1a1a" : "#ffffff");
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  saveTheme(state.theme);
  setRendererTheme(state.theme);
  renderPreview();
}

function bindShortcuts() {
  window.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "s" && !e.shiftKey) { e.preventDefault(); save(); }
    else if (k === "s" && e.shiftKey) { e.preventDefault(); saveAsCmd(); }
    else if (k === "o") { e.preventDefault(); open(); }
    else if (k === "n" && !e.shiftKey) { e.preventDefault(); newDoc(); }
  });
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ""; }
  });
}

async function newDoc() {
  if (state.dirty && !confirm("Discard unsaved changes?")) return;
  setDoc(state.view, "");
  state.handle = null;
  state.lastSavedText = "";
  setName("Untitled.md");
  setDirty(false);
}

async function open() {
  try {
    const result = await openFile();
    if (!result) return;
    setDoc(state.view, result.text);
    state.handle = result.handle;
    state.lastSavedText = result.text;
    setName(result.name);
    setDirty(false);
  } catch (e) {
    console.error(e);
    alert("Could not open file: " + (e?.message || e));
  }
}

async function save() {
  const text = getDoc(state.view);
  try {
    if (state.handle) {
      await saveToHandle(state.handle, text);
      state.lastSavedText = text;
      setDirty(false);
    } else {
      const result = await saveAs(text, state.name);
      if (!result) return;
      state.handle = result.handle;
      state.lastSavedText = text;
      setName(result.name);
      setDirty(false);
    }
  } catch (e) {
    console.error(e);
    alert("Could not save: " + (e?.message || e));
  }
}

async function saveAsCmd() {
  const text = getDoc(state.view);
  try {
    const result = await saveAs(text, state.name);
    if (!result) return;
    state.handle = result.handle;
    state.lastSavedText = text;
    setName(result.name);
    setDirty(false);
  } catch (e) {
    console.error(e);
    alert("Could not save: " + (e?.message || e));
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) =>
        console.warn("Service worker registration failed:", err)
      );
    });
  }
}

function handleLaunchQueue() {
  if (!("launchQueue" in window)) return;
  window.launchQueue.setConsumer(async (params) => {
    if (!params.files?.length) return;
    const handle = params.files[0];
    try {
      const file = await handle.getFile();
      const text = await file.text();
      if (state.dirty && !confirm("Discard unsaved changes to open " + file.name + "?")) return;
      setDoc(state.view, text);
      state.handle = handle;
      state.lastSavedText = text;
      setName(file.name);
      setDirty(false);
    } catch (e) {
      console.error("Launch queue:", e);
    }
  });
}

init();
