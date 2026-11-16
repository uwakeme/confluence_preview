/**
 * <ac:structured-macro ac:name="anchor"> — anchor target.
 *
 * The anchor name arrives as `anchor-name`, `anchor`, or an unnamed
 * parameter depending on the Confluence version.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr } from "../sanitize";

export function renderAnchorMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const name = (
    params["anchor-name"] ??
    params["anchor"] ??
    params[""] ??
    ""
  ).trim();
  if (!name) return "";
  return `<span id="${escapeAttr(name)}" class="cf-anchor"></span>`;
}