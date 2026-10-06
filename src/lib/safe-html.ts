import { parseFragment } from "parse5";

type HtmlNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: HtmlNode[];
};

type SanitizeOptions = {
  tags: readonly string[];
  attributes?: readonly string[];
};

const DROP_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript"]);
const VOID_TAGS = new Set(["br"]);

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeStyle(value: string): string {
  const declarations: string[] = [];
  for (const declaration of value.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const setting = declaration.slice(colon + 1).trim().toLowerCase();
    const valid =
      (property === "font-weight" && /^(normal|bold|[1-9]00)$/.test(setting)) ||
      (property === "font-style" && /^(normal|italic|oblique)$/.test(setting)) ||
      ((property === "text-decoration" || property === "text-decoration-line") && /^(none|underline|line-through)$/.test(setting)) ||
      (property === "text-align" && /^(left|right|center|justify)$/.test(setting)) ||
      ((property === "margin-left" || property === "padding-left") && /^-?\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/.test(setting));
    if (valid) declarations.push(`${property}:${setting}`);
  }
  return declarations.join(";");
}

function safeAttribute(name: string, value: string): string | null {
  if (name === "style") return safeStyle(value) || null;
  if (name === "class") return /^[\w\s-]{1,200}$/.test(value) ? value : null;
  if (name === "align") return /^(left|right|center|justify)$/i.test(value) ? value.toLowerCase() : null;
  if (name === "data-element" || name === "data-block-type") return /^[\w-]{1,80}$/.test(value) ? value : null;
  return null;
}

/** Render only the small HTML vocabulary used by storyboard and screenplay content. */
export function sanitizeHtml(html: string, options: SanitizeOptions): string {
  if (!html) return "";
  const tags = new Set(options.tags);
  const attributes = new Set(options.attributes ?? []);
  const root = parseFragment(html) as unknown as HtmlNode;

  function render(node: HtmlNode): string {
    if (node.nodeName === "#text") return escapeText(node.value ?? "");
    if (!node.tagName) return (node.childNodes ?? []).map(render).join("");
    const tag = node.tagName.toLowerCase();
    if (DROP_CONTENT.has(tag)) return "";
    const content = (node.childNodes ?? []).map(render).join("");
    if (!tags.has(tag)) return content;
    const safeAttributes = (node.attrs ?? []).flatMap(attribute => {
      if (!attributes.has(attribute.name)) return [];
      const value = safeAttribute(attribute.name, attribute.value);
      return value == null ? [] : [` ${attribute.name}="${escapeAttribute(value)}"`];
    }).join("");
    return VOID_TAGS.has(tag) ? `<${tag}${safeAttributes}>` : `<${tag}${safeAttributes}>${content}</${tag}>`;
  }

  return (root.childNodes ?? []).map(render).join("");
}
