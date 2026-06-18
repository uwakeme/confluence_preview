/**
 * Fallback renderer for unknown macros.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function fallbackMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  _params: Record<string, string>,
  bodyHtml: string,
  rawCdata: string,
): string {
  const name =
    el.attr("ac:name") ??
    el.attr("name") ??
    (el[0] as any).tagName?.replace(/^ac:/, "") ??
    "unknown";

  if (bodyHtml && bodyHtml.trim().length > 0) {
    return (
      `<div class="cf-macro-fallback">` +
      `<div class="cf-macro-fallback-label">⌘ ${escapeHtml(name)} macro</div>` +
      `<div class="cf-macro-fallback-body">${bodyHtml}</div>` +
      `</div>`
    );
  }
  if (rawCdata && rawCdata.trim().length > 0) {
    return (
      `<div class="cf-macro-fallback">` +
      `<div class="cf-macro-fallback-label">⌘ ${escapeHtml(name)} macro</div>` +
      `<pre class="cf-macro-fallback-pre">${escapeHtml(rawCdata)}</pre>` +
      `</div>`
    );
  }
  return `<div class="cf-macro-fallback"><div class="cf-macro-fallback-label">⌘ ${escapeHtml(
    name,
  )} macro</div></div>`;
}