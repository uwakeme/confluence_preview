/**
 * <ac:structured-macro ac:name="toc"> — Table of Contents.
 *
 * We don't render the macro in-place; we rely on the outline extractor
 * which walks the whole document. Here we return a hidden marker so the
 * position is preserved in the source stream.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";

export function renderTocMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  _params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  // The TOC content lives in the outline sidebar, not inline. Show a
  // subtle placeholder so users know a TOC was requested.
  const minLevel = parseInt(_params["minLevel"] ?? _params["minlevel"] ?? "1", 10);
  const maxLevel = parseInt(_params["maxLevel"] ?? _params["maxlevel"] ?? "7", 10);
  return `<aside class="cf-toc-marker" data-min="${minLevel}" data-max="${maxLevel}">📑 Table of Contents (see sidebar)</aside>`;
}