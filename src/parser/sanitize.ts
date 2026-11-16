/**
 * HTML escaping utilities for safe rendering.
 */

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

/**
 * Escape for use inside an HTML attribute value.
 */
export function escapeAttr(input: string | null | undefined): string {
  return escapeHtml(input);
}

/**
 * Slugify a heading text into a stable anchor id.
 */
export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      // Chinese chars: keep them, but normalize whitespace
      .replace(/[\s]+/g, "-")
      // strip anything that's not alnum, underscore, hyphen, or CJK
      .replace(/[^\p{Letter}\p{Number}_\-\u4e00-\u9fff]+/gu, "")
      .slice(0, 80) || "section"
  );
}

const CSS_COLOR_RE =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-]+\)|[a-z]{3,20})$/i;

export function isCssColor(value: string): boolean {
  return CSS_COLOR_RE.test(value.trim());
}

/**
 * Readable text color for a given background. Confluence's highlight
 * palette is pastel, but custom colors may be dark — pick by luminance.
 * Unparseable colors are assumed light.
 */
export function contrastText(color: string): string {
  const v = color.trim();
  let r = 255;
  let g = 255;
  let b = 255;
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
  if (hex) {
    let h = hex[1]!;
    if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
    if (rgb) {
      r = parseFloat(rgb[1]!);
      g = parseFloat(rgb[2]!);
      b = parseFloat(rgb[3]!);
    }
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1f2328" : "#f0f0f0";
}

const CSS_LENGTH_RE = /^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/;

export function isCssLength(value: string): boolean {
  return CSS_LENGTH_RE.test(value.trim());
}

const CSS_BORDER_STYLES = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
  "none",
  "hidden",
]);

export function isCssBorderStyle(value: string): boolean {
  return CSS_BORDER_STYLES.has(value.trim().toLowerCase());
}

// Values that could fetch remote resources or execute script must never
// reach a style attribute — the extension promises zero network traffic.
const UNSAFE_CSS_VALUE_RE =
  /url\s*\(|expression|javascript:|vbscript:|behavior|binding|@import|image-set|element\s*\(|paint\s*\(|cross-fade|\\|\/\*/i;

export function isSafeCssValue(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= 200 && !UNSAFE_CSS_VALUE_RE.test(v);
}

/**
 * Filter a raw style attribute down to an allowlist of properties with
 * safe values. Returns "" when nothing survives.
 */
export function sanitizeStyle(
  raw: string | undefined,
  allowedProperties: ReadonlySet<string>,
): string {
  if (!raw) return "";
  const kept: string[] = [];
  for (const decl of raw.split(";")) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (!allowedProperties.has(prop)) continue;
    if (!isSafeCssValue(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept.join("; ");
}

export function styleAttr(style: string): string {
  return style ? ` style="${escapeAttr(style)}"` : "";
}