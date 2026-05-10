import { Marked } from "marked";
import hljs from "highlight.js";
import katex from "katex";
import mermaid from "mermaid";
import DOMPurify from "dompurify";

let mermaidInited = false;
function initMermaid(theme) {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "strict",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
  });
  mermaidInited = true;
}

const slugCounts = new Map();
function slugify(text) {
  const base = text.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "section";
  const n = slugCounts.get(base) || 0;
  slugCounts.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const marked = new Marked({
  gfm: true,
  breaks: false
});

marked.use({
  extensions: [
    {
      name: "mermaid",
      level: "block",
      start(src) {
        const i = src.indexOf("```mermaid");
        return i < 0 ? undefined : i;
      },
      tokenizer(src) {
        const m = /^```mermaid\n([\s\S]*?)\n```/.exec(src);
        if (!m) return;
        return { type: "mermaid", raw: m[0], text: m[1] };
      },
      renderer(token) {
        const id = "mmd-" + Math.random().toString(36).slice(2, 10);
        const encoded = encodeURIComponent(token.text);
        return `<div class="mermaid" id="${id}" data-mmd="${encoded}"></div>`;
      }
    },
    {
      name: "mathBlock",
      level: "block",
      start(src) {
        const m = /\n?\$\$/.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(src) {
        const m = /^\$\$\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(src);
        if (!m) return;
        return { type: "mathBlock", raw: m[0], text: m[1] };
      },
      renderer(token) {
        try {
          const html = katex.renderToString(token.text, {
            throwOnError: false, displayMode: true, output: "html"
          });
          return `<div class="math-block">${html}</div>`;
        } catch {
          return `<pre>${escapeHtml(token.raw)}</pre>`;
        }
      }
    },
    {
      name: "mathInline",
      level: "inline",
      start(src) {
        const m = /\$[^\s$][^$\n]*\$/.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(src) {
        const m = /^\$([^\s$][^$\n]*?)\$(?!\d)/.exec(src);
        if (!m) return;
        return { type: "mathInline", raw: m[0], text: m[1] };
      },
      renderer(token) {
        try {
          return katex.renderToString(token.text, { throwOnError: false, output: "html" });
        } catch {
          return escapeHtml(token.raw);
        }
      }
    }
  ],
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = tokens.map((t) => t.raw || t.text || "").join("");
      const id = slugify(plain);
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    code({ text, lang }) {
      if (lang === "mermaid") {
        const id = "mmd-" + Math.random().toString(36).slice(2, 10);
        return `<div class="mermaid" id="${id}" data-mmd="${encodeURIComponent(text)}"></div>`;
      }
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const safeHref = /^(javascript|data|vbscript):/i.test(href || "") ? "#" : href;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const ext = /^https?:\/\//i.test(safeHref) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${safeHref}"${titleAttr}${ext}>${text}</a>`;
    }
  }
});

export async function render(markdownText, target, theme = "light") {
  slugCounts.clear();
  const rawHtml = marked.parse(markdownText);
  const clean = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ["data-mmd", "target", "id"],
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["onerror", "onload", "onclick"]
  });
  target.innerHTML = clean;

  if (!mermaidInited) initMermaid(theme);

  const mmdBlocks = target.querySelectorAll(".mermaid[data-mmd]");
  for (const el of mmdBlocks) {
    const code = decodeURIComponent(el.dataset.mmd || "");
    try {
      const { svg } = await mermaid.render(el.id + "-svg", code);
      el.innerHTML = svg;
    } catch (e) {
      el.innerHTML = `<pre class="mermaid-error">${escapeHtml(String(e?.message || e))}\n\n${escapeHtml(code)}</pre>`;
    }
    el.removeAttribute("data-mmd");
  }

  return Array.from(target.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
    level: Number(h.tagName[1]),
    text: h.textContent,
    id: h.id
  }));
}

export function setRendererTheme(theme) {
  mermaidInited = false;
  initMermaid(theme);
}
