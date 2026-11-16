/**
 * Pure URL/link helpers shared by the parser and the extension host.
 * No vscode / node imports — unit-testable in isolation.
 */

/** Schemes we allow to be opened in the user's external browser. */
export function isAllowedExternalHref(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

/** Render-level href guard: neutralize script-bearing schemes. */
export function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return "#";
  return trimmed;
}

/**
 * Build a real Confluence page URL from a base URL + ri:page reference.
 * Returns undefined when there is not enough information (no space key).
 */
export function buildPageUrl(
  baseUrl: string | undefined,
  spaceKey: string | undefined,
  title: string,
  anchor?: string,
): string | undefined {
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!base || !/^https?:\/\//i.test(base)) return undefined;
  if (!spaceKey) return undefined;
  let url = `${base}/display/${encodeURIComponent(spaceKey)}/${encodeURIComponent(title)}`;
  if (anchor) url += `#${encodeURIComponent(anchor)}`;
  return url;
}

export function buildJiraUrl(
  baseUrl: string | undefined,
  key: string,
): string | undefined {
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!base || !/^https?:\/\//i.test(base) || !key) return undefined;
  return `${base}/browse/${encodeURIComponent(key)}`;
}