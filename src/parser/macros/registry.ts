/**
 * Macro registry — each Confluence structured-macro name maps to a renderer.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { renderChildren } from "../elements";
import { extractCdata, readMacroParams, richBody, plainBody } from "../source";
import { escapeAttr, escapeHtml } from "../sanitize";
import { buildPageUrl, sanitizeHref } from "../../links";

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
  "table-of-content": renderTocMacro,
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
  ctx.macros.push(name.toLowerCase());

  const params = readMacroParams($, el);
  const rich = richBody($, el);
  const bodyHtml = rich.length > 0 ? renderChildren($, rich[0]!, ctx) : "";
  const rawCdata = plainBody($, el);

  return lookupMacro(name)($, el, ctx, params, bodyHtml, rawCdata);
}

/**
 * Inline macro handler: <ac:emoticon ac:name="..."/>
 */
export function renderInlineMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
): string {
  const name = (el[0] as any).tagName?.toLowerCase() ?? "";
  const macroName = name.replace(/^ac:/, "");
  ctx.macros.push(macroName);
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
  const anchor = el.attr("ac:anchor") ?? "";
  const linkBody = readLinkBody($, el, ctx);

  const page = el.children("ri\\:page").first();
  if (page.length > 0) {
    const title = page.attr("ri:content-title") ?? page.attr("title") ?? "Page";
    const spaceKey = page.attr("ri:space-key");
    const text = linkBody || escapeHtml(title);
    const realUrl = buildPageUrl(ctx.options.baseUrl, spaceKey, title, anchor || undefined);
    if (realUrl) {
      return `<a class="cf-link cf-page-link" href="${escapeAttr(realUrl)}" target="_blank" rel="noopener">${text}</a>`;
    }
    const label = anchor ? `${title} §${anchor}` : title;
    return `<a class="cf-link cf-page-link" href="#" title="${escapeAttr(label)} — internal page (set confluence-previewer.baseUrl to enable links)">${text}</a>`;
  }

  const att = el.children("ri\\:attachment").first();
  if (att.length > 0) {
    const filename = att.attr("ri:filename") ?? "attachment";
    const text = linkBody || `📎 ${escapeHtml(filename)}`;
    const local = ctx.options.resolveLocalFile?.(filename);
    if (local) {
      return `<a class="cf-link cf-attachment-link" href="#" data-attachment="${escapeAttr(filename)}" title="Open local attachment">${text}</a>`;
    }
    return `<a class="cf-link cf-attachment-link" href="#" title="Attachment (not resolvable offline)">${text}</a>`;
  }

  const url = el.children("ri\\:url").first();
  if (url.length > 0) {
    const href = sanitizeHref(url.attr("ri:value") ?? "#");
    const text = linkBody || escapeHtml(href);
    return `<a class="cf-link" href="${escapeAttr(href)}" target="_blank" rel="noopener">${text}</a>`;
  }

  const user = el.children("ri\\:user").first();
  if (user.length > 0) {
    const id =
      user.attr("ri:username") ??
      user.attr("ri:account-id") ??
      user.attr("ri:userkey") ??
      "user";
    return `<span class="cf-user-mention" title="${escapeAttr(id)}">@user</span>`;
  }

  // Same-page anchor link: <ac:link ac:anchor="name">…</ac:link>
  if (anchor) {
    const text = linkBody || escapeHtml(anchor);
    return `<a class="cf-link cf-anchor-link" href="#${escapeAttr(anchor)}">${text}</a>`;
  }

  return linkBody || renderChildren($, el[0]!, ctx);
}

/** Custom link text: plain-text-link-body (CDATA) or link-body (rich). */
function readLinkBody(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
): string {
  const plain = el.children("ac\\:plain-text-link-body").first();
  if (plain.length > 0) {
    const text = extractCdata(plain).trim();
    if (text) return escapeHtml(text);
  }
  const rich = el.children("ac\\:link-body").first();
  if (rich.length > 0) {
    return renderChildren($, rich[0]!, ctx);
  }
  return "";
}