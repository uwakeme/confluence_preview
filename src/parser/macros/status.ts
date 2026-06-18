/**
 * <ac:structured-macro ac:name="status"> — colored status pill.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";

const COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  grey: { bg: "#bbb", fg: "#fff" },
  gray: { bg: "#bbb", fg: "#fff" },
  green: { bg: "#14892c", fg: "#fff" },
  yellow: { bg: "#f6c342", fg: "#3b3b3b" },
  red: { bg: "#d04437", fg: "#fff" },
  blue: { bg: "#4f7cac", fg: "#fff" },
  purple: { bg: "#654982", fg: "#fff" },
  black: { bg: "#3b3b3b", fg: "#fff" },
};

export function renderStatusMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const title = params["title"] ?? params["colour"] ?? "Status";
  const colourKey = (params["colour"] ?? params["color"] ?? "grey").toLowerCase();
  const c = COLOR_MAP[colourKey] ?? COLOR_MAP["grey"]!;
  // Some Confluence sources put the title as text in a rich-text-body;
  // prefer the title param but fall back to that.
  const bodyText = el.find("ac\\:rich-text-body").first().text().trim();
  const display = title && title !== "Status" ? title : bodyText || "Status";
  return `<span class="cf-status-pill" style="background:${escapeAttr(
    c.bg,
  )};color:${escapeAttr(c.fg)}">${escapeHtml(display)}</span>`;
}