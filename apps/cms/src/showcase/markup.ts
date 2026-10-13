// Turns the light plain-text markup a showcase file uses for rich text (a text block's body, a post's body) into Lexical JSON,
// the format Payload stores. Paragraphs are separated by a blank line; a line starting with `## ` or `### ` is a heading, `- ` a
// bullet, `1. ` a numbered item, `> ` a quote. Inside a line: **bold**, *italic* and [text](https://example.org).

type LexicalNode = Record<string, unknown>;

const text = (value: string, format = 0): LexicalNode => ({ type: "text", text: value, format, detail: 0, mode: "normal", style: "", version: 1 });
const node = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}): LexicalNode => ({
  type,
  children,
  direction: "ltr",
  format: "",
  indent: 0,
  version: 1,
  ...extra,
});

const link = (label: string, url: string): LexicalNode => ({
  type: "link",
  children: [text(label)],
  direction: "ltr",
  format: "",
  indent: 0,
  version: 3,
  fields: { url, newTab: false, linkType: "custom" },
});

/** Bold, italic and links inside one line of text. */
export function inline(line: string): LexicalNode[] {
  const out: LexicalNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index! > last) out.push(text(line.slice(last, match.index)));
    if (match[1] !== undefined) out.push(text(match[1], 1));
    else if (match[2] !== undefined) out.push(text(match[2], 2));
    else out.push(link(match[3]!, match[4]!));
    last = match.index! + match[0].length;
  }
  if (last < line.length) out.push(text(line.slice(last)));
  return out.length > 0 ? out : [text("")];
}

const paragraph = (value: string): LexicalNode => node("paragraph", inline(value), { textFormat: 0 });

const list = (items: string[], ordered: boolean): LexicalNode =>
  node(
    "list",
    items.map((item, i) => node("listitem", inline(item), { value: i + 1 })),
    { listType: ordered ? "number" : "bullet", start: 1, tag: ordered ? "ol" : "ul" },
  );

/** The rich text (a Lexical root) for a piece of plain-text markup. */
export function markupToLexical(markup: string): { root: LexicalNode } {
  const children: LexicalNode[] = [];
  for (const chunk of markup.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const first = lines[0]!;
    if (/^#{2,3} /.test(first)) {
      const level = first.startsWith("###") ? 3 : 2;
      children.push(node("heading", inline(first.slice(level + 1)), { tag: `h${level}` }));
      if (lines.length > 1) children.push(paragraph(lines.slice(1).join(" ")));
    } else if (lines.every((l) => /^[-*] /.test(l))) {
      children.push(list(lines.map((l) => l.slice(2)), false));
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      children.push(list(lines.map((l) => l.replace(/^\d+\. /, "")), true));
    } else if (lines.every((l) => l.startsWith("> "))) {
      children.push(node("quote", inline(lines.map((l) => l.slice(2)).join(" "))));
    } else {
      children.push(paragraph(lines.join(" ")));
    }
  }
  if (children.length === 0) children.push(paragraph(""));
  return { root: { type: "root", children, direction: "ltr", format: "", indent: 0, version: 1 } };
}
