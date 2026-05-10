import { EditorState, EditorSelection } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection,
  crosshairCursor
} from "@codemirror/view";
import {
  defaultKeymap, history, historyKeymap, indentWithTab
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting, defaultHighlightStyle, indentOnInput,
  bracketMatching, foldGutter, foldKeymap, HighlightStyle
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  closeBrackets, closeBracketsKeymap,
  autocompletion, completionKeymap
} from "@codemirror/autocomplete";
import { tags as t } from "https://esm.sh/@lezer/highlight@1.2.1";

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.4em", fontWeight: "700", color: "var(--fg)" },
  { tag: t.heading2, fontSize: "1.25em", fontWeight: "700", color: "var(--fg)" },
  { tag: t.heading3, fontSize: "1.1em", fontWeight: "700", color: "var(--fg)" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "700", color: "var(--fg)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--accent)", textDecoration: "underline" },
  { tag: t.url, color: "var(--accent)" },
  { tag: t.monospace, fontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace', color: "var(--fg-mute)" },
  { tag: t.quote, color: "var(--fg-mute)", fontStyle: "italic" },
  { tag: t.list, color: "var(--accent)" },
  { tag: t.meta, color: "var(--fg-mute)" },
  { tag: t.comment, color: "var(--fg-mute)", fontStyle: "italic" }
]);

export function createEditor(parent, { initialDoc = "", onChange } = {}) {
  const updateListener = EditorView.updateListener.of((v) => {
    if (v.docChanged && onChange) onChange(v.state.doc.toString());
  });

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      highlightActiveLine(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(mdHighlight),
      markdown({ base: markdownLanguage, codeLanguages: () => null }),
      EditorView.lineWrapping,
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...searchKeymap,
        indentWithTab,
        { key: "Mod-b", run: wrapSelection("**", "**") },
        { key: "Mod-i", run: wrapSelection("*", "*") },
        { key: "Mod-`", run: wrapSelection("`", "`") },
        { key: "Mod-k", run: insertLink },
        { key: "Mod-Shift-x", run: toggleTaskListItem }
      ]),
      updateListener
    ]
  });

  return new EditorView({ state, parent });
}

function wrapSelection(before, after) {
  return ({ state, dispatch }) => {
    const changes = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const insert = before + text + after;
      const anchor = range.from + before.length + text.length;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(range.from + before.length, anchor)
      };
    });
    dispatch(state.update(changes));
    return true;
  };
}

function insertLink({ state, dispatch }) {
  const changes = state.changeByRange((range) => {
    const sel = state.sliceDoc(range.from, range.to);
    const text = sel || "link text";
    const insert = `[${text}](url)`;
    const urlStart = range.from + insert.length - 4;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 3)
    };
  });
  dispatch(state.update(changes));
  return true;
}

function toggleTaskListItem({ state, dispatch }) {
  const line = state.doc.lineAt(state.selection.main.head);
  const text = line.text;
  const m = /^(\s*[-*+]\s+)(\[[ x]\]\s+)?/.exec(text);
  if (!m) return false;
  const prefix = m[1];
  const hasBox = !!m[2];
  const isChecked = hasBox && m[2].includes("x");
  let replacement;
  if (!hasBox) replacement = prefix + "[ ] ";
  else if (!isChecked) replacement = prefix + "[x] ";
  else replacement = prefix;
  dispatch(state.update({
    changes: { from: line.from, to: line.from + m[0].length, insert: replacement }
  }));
  return true;
}

export function setDoc(view, doc) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
    selection: { anchor: 0 }
  });
}

export function getDoc(view) {
  return view.state.doc.toString();
}
