/**
 * Macro registry — each Confluence structured-macro name maps to a renderer.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { renderChildren } from "../elements";
import { extractCdata } from "../index";

import { renderCodeMacro } from "./code";
import { renderTocMacro } from "./toc";
import { renderPanelMacro } from "./panel";
import {
  renderNoteMacro,
  renderInfoMacro,
  renderWarningMacro,
  renderTipMacro,
} from "./panel";
import { renderExpandMacro } from "./expand";
import { renderStatusMacro } from "./status";
import { renderExcerptMacro, renderExcerptIncludeMacro } from "./excerpt";
import { renderQuoteMacro } from "./quote";
import { renderNoformatMacro } from "./noformat";
import { renderChildrenMacro } from "./children";
import { renderAnchorMacro } from "./anchor";
import { renderJiraMacro } from "./jira";
import { renderUserMentionMacro } from "./mention";
import { renderSectionMacro, renderColumnMacro } from "./layout";
import { renderEmoticonMacro } from "./emoticon";
import { renderLinkMacro } from "./link";
import { fallbackMacro } from "./fallback";

type MacroRenderer = (
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  rawCdata: string,
) => string;

const REGISTRY: Record<string, MacroRenderer> = {
  code: renderCodeMacro,
  toc: renderTocMacro,
  "table-of-contents": renderTocMacro,
  panel: renderPanelMacro,
  note: renderNoteMacro,
  info: renderInfoMacro,
  warning: renderWarningMacro,
  tip: renderTipMacro,
  expand: renderExpandMacro,
  status: renderStatusMacro,
  excerpt: renderExcerptMacro,
  "excerpt-include": renderExcerptIncludeMacro,
  quote: renderQuoteMacro,
  noformat: renderNoformatMacro,
  children: renderChildrenMacro,
  anchor: renderAnchorMacro,
  jira: renderJiraMacro,
  "user-mention": renderUserMentionMacro,
  section: renderSectionMacro,
  column: renderColumnMacro,
  emoticon: renderEmoticonMacro,
  cheese: renderEmoticonMacro,
  link: renderLinkMacro,
  pagelink: renderLinkMacro,
};

export function lookupMacro(name: string): MacroRenderer {
  return REGISTRY[name.toLowerCase()] ?? fallbackMacro;
}

export function renderStructuredMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
): string {
  const name = el.attr("ac:name") ?? el.attr("name") ?? "unknown";
  const params: Record<string, string> = {};
  el.find("ac\\:parameter").each((_, p) => {
    const pName = $(p).attr("ac:name") ?? $(p).attr("name");
    if (pName) params[pName] = $(p).text();
  });

  // Body: prefer rich-text-body, fall back to plain-text-body
  let bodyHtml = "";
  const richBody = el.find("ac\\:rich-text-body").first();
  if (richBody.length > 0) {
    bodyHtml = renderChildren($, richBody[0]!, ctx);
  }

  // Raw CDATA content (for code/noformat-style macros that need the
  // exact source text including indentation and special characters).
  const plainBody = el.find("ac\\:plain-text-body").first();
  const rawCdata = plainBody.length > 0 ? extractCdata(plainBody) : "";

  return lookupMacro(name)($, el, ctx, params, bodyHtml, rawCdata);
}

/**
 * Inline macro handler: <ac:macro-name ac:name="..."/>
 */
export function renderInlineMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
): string {
  const name = (el[0] as any).tagName?.toLowerCase() ?? "";
  const macroName = name.replace(/^ac:/, "");
  const renderer = lookupMacro(macroName);
  return renderer($, el, ctx, {}, renderChildren($, el[0]!, ctx), "");
}

/**
 * ac:link wrapper: <ac:link><ri:page .../></ac:link>
 *
 * This is a structured link, not a macro, but it has its own resolution
 * logic so we handle it here rather than in elements.ts.
 */
export function renderAcLink(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
): string {
  const page = el.find("ri\\:page").first();
  if (page.length > 0) {
    const title = page.attr("ri:content-title") ?? page.attr("title") ?? "Page";
    return `<a class="cf-link cf-page-link" href="#" title="Internal page (not resolvable offline)">${escapeText(
      title,
    )}</a>`;
  }

  const att = el.find("ri\\:attachment").first();
  if (att.length > 0) {
    const filename = att.attr("ri:filename") ?? "attachment";
    return `<a class="cf-link cf-attachment-link" href="#" title="Attachment (not resolvable offline)">📎 ${escapeText(
      filename,
    )}</a>`;
  }

  const url = el.find("ri\\:url").first();
  if (url.length > 0) {
    const href = url.attr("ri:value") ?? "#";
    const linkText = renderChildren($, el[0]!, ctx) || href;
    return `<a class="cf-link" href="${escapeAttr(
      href,
    )}" target="_blank" rel="noopener">${linkText}</a>`;
  }

  const user = el.find("ri\\:user").first();
  if (user.length > 0) {
    const username = user.attr("ri:username") ?? "user";
    return `<span class="cf-user-mention">@${escapeText(username)}</span>`;
  }

  return renderChildren($, el[0]!, ctx);
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}