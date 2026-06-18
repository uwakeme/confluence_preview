/**
 * <ac:structured-macro ac:name="link"> — rendered link with optional icon.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";
import { renderChildren } from "../elements";

export function renderLinkMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  rawCdata: string,
): string {
  // Prefer rich-text-body link text, then plain-text-body CDATA, then params.
  const rich = el.find("ac\\:rich-text-body").first();
  let linkText = "";
  if (rich.length > 0) {
    linkText = renderChildren($, rich[0]!, ctx);
  } else if (rawCdata) {
    linkText = escapeHtml(rawCdata);
  }
  if (!linkText) linkText = params["anchor"] ?? params["url"] ?? "link";

  const href = params["url"] ?? params["href"] ?? "#";
  return `<a class="cf-link cf-macro-link" href="${escapeAttr(
    href,
  )}" target="_blank" rel="noopener">${linkText}</a>`;
}