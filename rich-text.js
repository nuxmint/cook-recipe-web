// Formatting in 제조방법 and 메모 is kept as short marks inside the plain text, so the database, the .md file
// and the Gemini answer flow stay plain text:
//   **굵게**   ==형광펜==   {빨강:글자} {노랑:…} {파랑:…} {초록:…} {주황:…} {보라:…}   {크게:글자} {작게:…}
// Marks may nest, e.g. {빨강:**글자**}. A mark without its partner stays as typed. Marks never cross a line.
// The editing box shows the formatting itself; the marks are only what gets saved.
// The same file is used by Cafe Note and Cook Note; keep the two copies identical.

const RICH_TAGS = [
  ["빨강", "color", "red"], ["노랑", "color", "yellow"], ["파랑", "color", "blue"],
  ["초록", "color", "green"], ["주황", "color", "orange"], ["보라", "color", "purple"],
  ["크게", "size", "big"], ["작게", "size", "small"],
];
const RICH_STYLES = {
  bold: { name: "bold", open: "**", close: "**", group: "bold" },
  mark: { name: "mark", open: "==", close: "==", group: "mark" },
};
for (const [word, group, name] of RICH_TAGS) RICH_STYLES[name] = { name, open: `{${word}:`, close: "}", group };
const RICH_PLAIN = { bold: false, mark: false, color: null, size: null };
// Written outside in, so {크게:{빨강:==**글자**==}} is how every mark of a piece of text is put back.
const RICH_LAYERS = ["size", "color", "mark", "bold"];
// "1. " and "- " at the start of a line belong to the list, not to the formatted words.
const RICH_LIST_MARK = /^\s*(?:\d+[.)]\s+|[-•]\s+)?/;

function richOpener(text, index) {
  if (text.startsWith("**", index)) return RICH_STYLES.bold;
  if (text.startsWith("==", index)) return RICH_STYLES.mark;
  if (text[index] !== "{") return null;
  return Object.values(RICH_STYLES).find((style) => style.close === "}" && text.startsWith(style.open, index)) || null;
}

// The text as a tree of { text, at } pieces (at = where the piece starts in text) and { style, nodes }.
// Results are remembered per position, so text full of unmatched marks stays quick.
function richTree(text) {
  const known = new Map();
  function run(start, closer) {
    const key = `${start}|${closer}`;
    if (known.has(key)) return known.get(key);
    // No closing mark anywhere after this point: give up at once instead of reading to the end.
    if (closer && text.indexOf(closer, start) === -1) return null;
    const nodes = [];
    let plainAt = start;
    let index = start;
    let result = null;
    const flush = () => {
      if (index > plainAt) nodes.push({ text: text.slice(plainAt, index), at: plainAt });
    };
    while (index < text.length) {
      if (closer && text.startsWith(closer, index)) {
        flush();
        result = { nodes, end: index };
        break;
      }
      const style = richOpener(text, index);
      if (!style) {
        index += 1;
        continue;
      }
      const inner = run(index + style.open.length, style.close);
      if (inner && inner.nodes.length) {
        flush();
        nodes.push({ style: style.name, nodes: inner.nodes });
        index = inner.end + style.close.length;
        plainAt = index;
      } else {
        index += style.open.length; // an unmatched mark is just text
      }
    }
    if (!closer) {
      flush();
      result = { nodes, end: text.length };
    }
    known.set(key, result);
    return result;
  }
  return run(0, "").nodes;
}

function richFlag(style) {
  return style.group === "bold" || style.group === "mark" ? true : style.name;
}

// Flat pieces of text, each with the formatting it is drawn with. The innermost colour and size win.
function richTokens(text) {
  const tokens = [];
  const walk = (nodes, flags) => {
    for (const node of nodes) {
      if (node.text !== undefined) tokens.push({ text: node.text, at: node.at, ...flags });
      else walk(node.nodes, { ...flags, [RICH_STYLES[node.style].group]: richFlag(RICH_STYLES[node.style]) });
    }
  };
  walk(richTree(text || ""), RICH_PLAIN);
  return tokens;
}

function richPlain(text) {
  return richTokens(text).map((token) => token.text).join("");
}

// DOM nodes for one line. Text always goes in as text nodes, never as HTML.
function richText(text) {
  return richTokens(text).map((token) => {
    let node = document.createTextNode(token.text);
    if (token.bold) {
      const strong = document.createElement("strong");
      strong.append(node);
      node = strong;
    }
    if (token.mark) {
      const mark = document.createElement("mark");
      mark.append(node);
      node = mark;
    }
    const classes = [token.color && `tx-${token.color}`, token.size && `tx-${token.size}`].filter(Boolean);
    if (classes.length) {
      const span = document.createElement("span");
      span.className = classes.join(" ");
      span.append(node);
      node = span;
    }
    return node;
  });
}

// Several lines for a white-space: pre-wrap box.
function richLines(text) {
  return (text || "").split("\n").flatMap((line, index) => (index ? ["\n", ...richText(line)] : richText(line)));
}

/* ---------- characters ----------
   For editing, text is read into one entry per character (emoji count as one) with its formatting, changed,
   and written back. Positions given to these functions count the shown text (no marks) in UTF-16 units, as the
   browser's selection does. */

function richChars(value) {
  const chars = [];
  (value || "").split("\n").forEach((line, index) => {
    if (index) chars.push({ ch: "\n", ...RICH_PLAIN });
    for (const token of richTokens(line)) {
      for (const ch of token.text) chars.push({ ch, bold: token.bold, mark: token.mark, color: token.color, size: token.size });
    }
  });
  return chars;
}

function richStyleOf(layer, flag) {
  if (!flag) return null;
  return layer === "bold" || layer === "mark" ? RICH_STYLES[layer] : RICH_STYLES[flag];
}

// One line of characters back to marked-up text.
function richWrite(chars) {
  let text = "";
  const write = (part, layer) => {
    if (layer === RICH_LAYERS.length) {
      for (const char of part) text += char.ch;
      return;
    }
    const key = RICH_LAYERS[layer];
    for (let i = 0; i < part.length;) {
      let j = i;
      while (j < part.length && part[j][key] === part[i][key]) j += 1;
      const style = richStyleOf(key, part[i][key]);
      if (style) text += style.open;
      write(part.slice(i, j), layer + 1);
      if (style) text += style.close;
      i = j;
    }
  };
  write(chars, 0);
  return text;
}

function richFromChars(chars) {
  const lines = [[]];
  for (const char of chars) {
    if (char.ch === "\n") lines.push([]);
    else lines[lines.length - 1].push(char);
  }
  return lines.map(richWrite).join("\n");
}

// The index of the character that starts at this position.
function richIndex(chars, position) {
  let at = 0;
  for (let i = 0; i < chars.length; i += 1) {
    if (at >= position) return i;
    at += chars[i].ch.length;
  }
  return chars.length;
}

// The chosen words on each line, leaving out the list mark at a line start and spaces at either end.
function richSegments(plain, start, end) {
  const segments = [];
  let lineStart = plain.lastIndexOf("\n", start - 1) + 1;
  for (;;) {
    let lineEnd = plain.indexOf("\n", lineStart);
    if (lineEnd === -1) lineEnd = plain.length;
    let from = Math.max(start, lineStart);
    let to = Math.min(end, lineEnd);
    if (from === lineStart) from += plain.slice(lineStart, lineEnd).match(RICH_LIST_MARK)[0].length;
    while (from < to && /\s/.test(plain[from])) from += 1;
    while (to > from && /\s/.test(plain[to - 1])) to -= 1;
    if (to > from) segments.push({ from, to });
    if (lineEnd >= end || lineEnd === plain.length) break;
    lineStart = lineEnd + 1;
  }
  return segments;
}

// The text with the shown characters start..end put in a style, or "clear" for no formatting at all.
// When all of them already have the style it comes off; another colour or size replaces the old one.
// "clear" with nothing chosen clears the whole line. null when nothing changes.
function richFormat(value, start, end, name) {
  const chars = richChars(value);
  const plain = chars.map((char) => char.ch).join("");
  if (start === end) {
    if (name !== "clear") return null;
    start = plain.lastIndexOf("\n", start - 1) + 1;
    end = plain.indexOf("\n", start);
    if (end === -1) end = plain.length;
  }
  const segments = richSegments(plain, start, end);
  let at = 0;
  const chosen = chars.filter((char) => {
    const inside = segments.some((segment) => at >= segment.from && at < segment.to);
    at += char.ch.length;
    return inside;
  });
  if (!chosen.length) return null;
  if (name === "clear") {
    for (const char of chosen) Object.assign(char, RICH_PLAIN);
  } else {
    const style = RICH_STYLES[name];
    const on = richFlag(style);
    const off = chosen.every((char) => char[style.group] === on);
    for (const char of chosen) char[style.group] = off ? RICH_PLAIN[style.group] : on;
  }
  const next = richFromChars(chars);
  return next === value ? null : next;
}

// The text with str in place of the shown characters start..end. New letters take the formatting of the letter
// before them, as typing does. Returns the text and where the cursor goes.
function richInsert(value, start, end, str) {
  const chars = richChars(value);
  const i = richIndex(chars, start);
  const j = richIndex(chars, end);
  const before = i > 0 && chars[i - 1].ch !== "\n" ? chars[i - 1] : RICH_PLAIN;
  const flags = { bold: before.bold, mark: before.mark, color: before.color, size: before.size };
  chars.splice(i, j - i, ...Array.from(str, (ch) => (ch === "\n" ? { ch, ...RICH_PLAIN } : { ch, ...flags })));
  return { text: richFromChars(chars), caret: start + str.length };
}

/* ---------- the editing box (browser only) ---------- */

const RICH_BLOCKS = new Set(["DIV", "P", "LI"]);

// The characters a box shows, with their formatting. Line breaks the browser made itself (<br>, <div>) count too.
function richDomChars(root) {
  const chars = [];
  const walk = (node, flags) => {
    if (node.nodeType === 3) {
      for (const ch of node.data) chars.push({ ch, ...flags });
      return;
    }
    if (node.nodeName === "BR") {
      chars.push({ ch: "\n", ...RICH_PLAIN });
      return;
    }
    if (node !== root && RICH_BLOCKS.has(node.nodeName) && chars.length && chars[chars.length - 1].ch !== "\n") {
      chars.push({ ch: "\n", ...RICH_PLAIN });
    }
    let inner = flags;
    if (node.nodeName === "STRONG" || node.nodeName === "B") inner = { ...inner, bold: true };
    if (node.nodeName === "MARK") inner = { ...inner, mark: true };
    for (const name of node.classList || []) {
      const style = name.startsWith("tx-") && RICH_STYLES[name.slice(3)];
      if (style && style.group !== "bold" && style.group !== "mark") inner = { ...inner, [style.group]: style.name };
    }
    (node.childNodes || []).forEach((child) => walk(child, inner));
  };
  walk(root, RICH_PLAIN);
  return chars;
}

// What a box holds, as marked-up text. Every box ends with one line break of its own so a new last line shows.
function richDomText(root) {
  const chars = richDomChars(root);
  if (chars.length && chars[chars.length - 1].ch === "\n") chars.pop();
  return richFromChars(chars);
}

function richOffset(root, node, offset) {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return richDomChars(range.cloneContents()).reduce((sum, char) => sum + char.ch.length, 0);
}

// [start, end] of the selection inside the box, counted in shown characters; null when it is elsewhere.
function richSelection(root) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return [richOffset(root, range.startContainer, range.startOffset), richOffset(root, range.endContainer, range.endOffset)];
}

function richSelect(root, start, end = start) {
  const place = (position) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let left = position;
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (left <= node.data.length) return [node, left];
      left -= node.data.length;
      last = node;
    }
    return last ? [last, last.data.length] : [root, 0];
  };
  const range = document.createRange();
  range.setStart(...place(start));
  range.setEnd(...place(end));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

// A box for 제조방법 or 메모 that shows its formatting while it is edited. onchange gets the marked-up text.
// Line breaks and pasted text go in as plain text, and the box keeps its own ⌘Z history, because the browser's
// own history cannot follow text the box draws again.
function richBox({ value, placeholder = "", className = "", onchange }) {
  const box = document.createElement("div");
  box.className = ["rich-box", className].filter(Boolean).join(" ");
  try {
    box.contentEditable = "plaintext-only";
  } catch {
    box.contentEditable = "true";
  }
  box.setAttribute("role", "textbox");
  box.setAttribute("aria-multiline", "true");
  if (placeholder) {
    box.dataset.placeholder = placeholder;
    box.setAttribute("aria-placeholder", placeholder);
  }

  let text = value || "";
  let typing = false; // a Korean syllable still being put together
  const history = [{ text, select: null, typed: false }];
  let step = 0;
  let typedAt = 0;

  const show = (select) => {
    box.replaceChildren(...richLines(text), "\n");
    box.classList.toggle("is-empty", !text);
    if (select) {
      box.focus({ preventScroll: true });
      richSelect(box, ...select);
    }
  };
  // Typing within a second goes into one ⌘Z step.
  const record = (typed) => {
    const entry = { text, select: richSelection(box), typed };
    const now = Date.now();
    if (typed && history[step].typed && step === history.length - 1 && now - typedAt < 1000) history[step] = entry;
    else {
      history.splice(step + 1, Infinity, entry);
      if (history.length > 200) history.shift();
      step = history.length - 1;
    }
    typedAt = now;
  };
  const put = (next, select) => {
    text = next;
    show(select);
    record(false);
    onchange(text);
  };
  const read = () => {
    const next = richDomText(box);
    box.classList.toggle("is-empty", !next);
    if (next === text) return;
    text = next;
    // The browser made line breaks or styles of its own: draw the box again from the text.
    const tail = box.lastChild;
    if (box.querySelector("br, div, p, b, i, u, font") || !tail || tail.nodeType !== 3 || !tail.data.endsWith("\n")) {
      show(richSelection(box));
    }
    record(true);
    onchange(text);
  };
  const undo = (by) => {
    const target = step + by;
    if (target < 0 || target >= history.length) return;
    step = target;
    text = history[step].text;
    show(history[step].select || [text.length, text.length]);
    onchange(text);
  };
  const insert = (str, range = richSelection(box) || [text.length, text.length]) => {
    const result = richInsert(text, range[0], range[1], str);
    put(result.text, [result.caret, result.caret]);
  };
  // false when there are no words chosen to format.
  const format = (name, range = richSelection(box)) => {
    if (!range || (range[0] === range[1] && name !== "clear")) return false;
    const next = richFormat(text, range[0], range[1], name);
    if (next === null) show(range);
    else put(next, range);
    return true;
  };

  box.addEventListener("compositionstart", () => { typing = true; });
  box.addEventListener("compositionend", () => {
    typing = false;
    read();
  });
  box.addEventListener("input", (event) => {
    if (!typing && !event.isComposing) read();
  });
  box.addEventListener("beforeinput", (event) => {
    const type = event.inputType || "";
    if (type === "historyUndo" || type === "historyRedo") {
      event.preventDefault();
      undo(type === "historyUndo" ? -1 : 1);
    } else if ((type === "insertParagraph" || type === "insertLineBreak") && event.cancelable) {
      event.preventDefault();
      insert("\n");
    } else if (type.startsWith("format")) {
      event.preventDefault();
    }
  });
  box.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229 || !(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.code === "KeyZ") {
      event.preventDefault();
      undo(event.shiftKey ? 1 : -1);
    } else if (event.code === "KeyY") {
      event.preventDefault();
      undo(1);
    } else if (event.code === "KeyI" || event.code === "KeyU") {
      event.preventDefault();
    }
  });
  box.addEventListener("paste", (event) => {
    event.preventDefault();
    insert((event.clipboardData.getData("text/plain") || "").replace(/\r\n?/g, "\n"));
  });
  box.addEventListener("drop", (event) => event.preventDefault());

  show(null);
  return { element: box, format, insert, range: () => richSelection(box) };
}

if (typeof module !== "undefined") {
  module.exports = {
    RICH_STYLES, richTree, richTokens, richPlain, richChars, richFromChars, richSegments, richFormat, richInsert,
    richDomChars, richDomText,
  };
}
