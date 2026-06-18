/**
 * <ac:structured-macro ac:name="noformat"> — preformatted text, no escaping.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function renderNoformatMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  _params: Record<string, string>,
  _bodyHtml: string,
  rawCdata: string,
): string {
  return `<pre class="cf-noformat">${escapeHtml(rawCdata)}</pre>`;
}