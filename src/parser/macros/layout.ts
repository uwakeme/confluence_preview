/**
 * Layout macros: <ac:structured-macro ac:name="section"> | "column"
 *
 * section → wraps columns in a flex/grid row.
 * column → individual column within a section.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";

export function renderSectionMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  _params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return `<div class="cf-section">${bodyHtml}</div>`;
}

export function renderColumnMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  const width = params["width"] ?? "";
  const style = width ? ` style="flex: ${width}"` : "";
  return `<div class="cf-column"${style}>${bodyHtml}</div>`;
}