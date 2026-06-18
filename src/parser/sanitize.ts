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

/**
 * Wrap raw text safely in a <pre><code> block.
 */
export function renderPreCode(text: string, language?: string): string {
  const langClass = language ? ` class="language-${escapeAttr(language)} hljs"` : ' class="hljs"';
  return `<pre><code${langClass}>${escapeHtml(text)}</code></pre>`;
}