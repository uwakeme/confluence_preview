/**
 * <ac:structured-macro ac:name="expand"> — collapsible block.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function renderExpandMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  const title = params["title"] ?? "Click to expand...";
  return `<details class="cf-expand"><summary class="cf-expand-title">${escapeHtml(
    title,
  )}</summary><div class="cf-expand-body">${bodyHtml}</div></details>`;
}