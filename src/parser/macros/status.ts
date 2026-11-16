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
  const colourKey = (params["colour"] ?? params["color"] ?? "grey").toLowerCase();
  const c = COLOR_MAP[colourKey] ?? COLOR_MAP["grey"]!;
  // Some Confluence sources put the title as text in a rich-text-body;
  // prefer an explicit title param, then the body text.
  const bodyText = el.children("ac\\:rich-text-body").first().text().trim();
  const display = params["title"] ?? (bodyText || "Status");
  const subtle = isTruthy(params["subtle"]);
  const style = subtle
    ? `border:1px solid ${escapeAttr(c.bg)};color:${escapeAttr(c.bg)}`
    : `background:${escapeAttr(c.bg)};color:${escapeAttr(c.fg)}`;
  return `<span class="cf-status-pill" style="${style}">${escapeHtml(display)}</span>`;
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}