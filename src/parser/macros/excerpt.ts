/**
 * <ac:structured-macro ac:name="excerpt"> | "excerpt-include"
 *
 * excerpt: defines a reusable snippet (registered for same-page includes).
 * excerpt-include: pulls an excerpt. Same-document excerpts are resolved
 * in a second pass; cross-page references stay placeholders (offline).
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";

export function renderExcerptMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  const name = (params["name"] ?? "").trim() || "default";
  ctx.excerpts.set(name, bodyHtml);
  const hidden = isTruthy(params["hidden"]);
  if (hidden) {
    return `<aside class="cf-excerpt cf-excerpt-hidden">Excerpt (hidden)<div class="cf-excerpt-body">${bodyHtml}</div></aside>`;
  }
  return `<aside class="cf-excerpt"><div class="cf-excerpt-label">Excerpt</div><div class="cf-excerpt-body">${bodyHtml}</div></aside>`;
}

export function renderExcerptIncludeMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const name = (params["name"] ?? params["ref"] ?? "").trim() || "default";
  const page = el.children("ri\\:page").first();
  const crossPage = page.length > 0 && !!page.attr("ri:content-title");
  const idx = ctx.excerptIncludes.length;
  ctx.excerptIncludes.push({ name, crossPage });
  return `<div class="cf-excerpt-include" data-excerpt-idx="${idx}"></div>`;
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}