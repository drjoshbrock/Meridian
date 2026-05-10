const fileTypes = [{
  description: "Markdown",
  accept: {
    "text/markdown": [".md", ".markdown"],
    "text/plain": [".txt"]
  }
}];

export async function openFile() {
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: fileTypes, multiple: false });
      const file = await handle.getFile();
      const text = await file.text();
      return { handle, name: file.name, text };
    } catch (e) {
      if (e?.name === "AbortError") return null;
      throw e;
    }
  }
  return openFileFallback();
}

function openFileFallback() {
  return new Promise((resolve, reject) => {
    const input = document.getElementById("file-input");
    const cleanup = () => { input.onchange = null; };
    input.onchange = async () => {
      const file = input.files?.[0];
      input.value = "";
      cleanup();
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve({ handle: null, name: file.name, text });
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

export async function saveToHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function saveAs(text, suggestedName = "Untitled.md") {
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: fileTypes });
      await saveToHandle(handle, text);
      return { handle, name: handle.name };
    } catch (e) {
      if (e?.name === "AbortError") return null;
      throw e;
    }
  }
  const blob = new Blob([text], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { handle: null, name: suggestedName };
}

export function hasFileSystemAccess() {
  return "showOpenFilePicker" in window;
}
