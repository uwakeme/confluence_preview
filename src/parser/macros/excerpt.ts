/**
 * <ac:structured-macro ac:name="excerpt"> | "excerpt-include"
 *
 * excerpt: defines a reusable snippet.
 * excerpt-include: pulls an excerpt from another page (offline → placeholder).
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function renderExcerptMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  const hidden = isTruthy(params["hidden"]);
  if (hidden) {
    return `<aside class="cf-excerpt cf-excerpt-hidden">Excerpt (hidden)<div class="cf-excerpt-body">${bodyHtml}</div></aside>`;
  }
  return `<aside class="cf-excerpt"><div class="cf-excerpt-label">Excerpt</div><div class="cf-excerpt-body">${bodyHtml}</div></aside>`;
}

export function renderExcerptIncludeMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const ref = params["name"] ?? params["ref"] ?? "unknown";
  return `<aside class="cf-excerpt cf-excerpt-include"><div class="cf-excerpt-label">Excerpt from “${escapeHtml(
    ref,
  )}”</div><div class="cf-excerpt-body">— not resolvable offline —</div></aside>`;
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}