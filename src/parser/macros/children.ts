/**
 * <ac:structured-macro ac:name="children"> — list child pages.
 *
 * Offline → placeholder.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function renderChildrenMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const depth = params["depth"] ?? "∞";
  return `<aside class="cf-children-placeholder"><span>📂</span> Child pages (depth=${escapeHtml(
    depth,
  )}) — not resolvable offline</aside>`;
}