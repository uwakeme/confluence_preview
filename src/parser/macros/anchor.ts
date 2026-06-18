/**
 * <ac:structured-macro ac:name="anchor"> — anchor target.
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
  const name = params["anchor"] ?? "_self";
  return `<span id="${escapeAttr(name)}" class="cf-anchor"></span>`;
}