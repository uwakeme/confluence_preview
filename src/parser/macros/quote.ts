/**
 * <ac:structured-macro ac:name="quote"> — block quote.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function renderQuoteMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  _params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return `<blockquote class="cf-quote cf-quote-macro"><div class="cf-quote-body">${bodyHtml}</div></blockquote>`;
}