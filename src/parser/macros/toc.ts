/**
 * <ac:structured-macro ac:name="toc"> — Table of Contents.
 *
 * Rendered in-place from the finalized outline in a second pass (the
 * outline is only complete after the whole document has been walked).
 * Here we record the request and emit a marker div.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";

export function renderTocMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const minRaw = parseInt(params["minLevel"] ?? params["minlevel"] ?? "1", 10);
  const maxRaw = parseInt(params["maxLevel"] ?? params["maxlevel"] ?? "7", 10);
  const min = Number.isFinite(minRaw) ? Math.min(Math.max(minRaw, 1), 6) : 1;
  const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 7) : 7;
  const type = (params["type"] ?? "list").toLowerCase() === "flat" ? "flat" : "list";
  const idx = ctx.tocs.length;
  ctx.tocs.push({ min, max, type });
  return `<div class="cf-toc" data-toc-idx="${idx}"></div>`;
}