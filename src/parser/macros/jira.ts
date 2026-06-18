/**
 * <ac:structured-macro ac:name="jira"> — JIRA issue link.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";

export function renderJiraMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const key = params["key"] ?? "PROJ-1";
  const baseUrl = (params["baseurl"] ?? params["server"] ?? "").replace(/\/+$/, "");
  const href = baseUrl ? `${baseUrl}/browse/${key}` : "#";
  return `<a class="cf-link cf-jira-link" href="${escapeAttr(
    href,
  )}" target="_blank" rel="noopener">🎫 ${escapeHtml(key)}</a>`;
}