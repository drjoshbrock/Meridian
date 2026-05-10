export function renderOutline(container, headings, onJump) {
  container.innerHTML = "";
  if (!headings.length) {
    const empty = document.createElement("div");
    empty.className = "outline-empty";
    empty.style.cssText = "color: var(--fg-mute); font-size: 12px; padding: 8px;";
    empty.textContent = "No headings yet.";
    container.appendChild(empty);
    return;
  }
  for (const h of headings) {
    const a = document.createElement("a");
    a.textContent = h.text;
    a.href = "#" + h.id;
    a.className = "outline-item level-" + h.level;
    a.title = h.text;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      onJump?.(h);
    });
    container.appendChild(a);
  }
}
