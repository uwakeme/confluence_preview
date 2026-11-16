/**
 * <ac:structured-macro ac:name="jira"> — JIRA issue link.
 *
 * Real storage format carries a server *name* (not URL); the URL comes
 * from the baseurl parameter or the confluence-previewer.jiraBaseUrl
 * setting. Without either, render an unlinked badge.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";
import { buildJiraUrl } from "../../links";

export function renderJiraMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const key = (params["key"] ?? "").trim() || "PROJ-1";
  const base = params["baseurl"] ?? params["serverUrl"] ?? ctx.options.jiraBaseUrl;
  const href = buildJiraUrl(base, key);
  if (!href) {
    return `<span class="cf-jira-link cf-jira-badge" title="Set confluence-previewer.jiraBaseUrl to enable links">🎫 ${escapeHtml(key)}</span>`;
  }
  return `<a class="cf-link cf-jira-link" href="${escapeAttr(
    href,
  )}" target="_blank" rel="noopener">🎫 ${escapeHtml(key)}</a>`;
}