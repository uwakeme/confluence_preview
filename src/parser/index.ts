/**
 * Confluence Storage Format parser.
 *
 * Public API: parseConfluence(source, options?) → ParseResult
 */

import { makeOutlineCollector } from "./outline";
import type { OutlineNode } from "./outline";
import { renderChildren } from "./elements";
import type { RenderContext, TocRequest } from "./elements";
import { escapeAttr, escapeHtml } from "./sanitize";
import { loadDocument } from "./source";
import type { ParseOptions, ParseResult } from "./types";

export type { ParseResult, ParseOptions } from "./types";
export type { OutlineNode } from "./outline";
export { extractCdata, loadDocument } from "./source";
export { confluenceToMarkdown } from "./markdown";
export { isAllowedExternalHref, sanitizeHref, buildPageUrl, buildJiraUrl } from "../links";

export function parseConfluence(
  source: string,
  options: ParseOptions = {},
): ParseResult {
  const { $, root } = loadDocument(source);

  const outlineCollector = makeOutlineCollector(source);
  const ctx: RenderContext = {
    outline: outlineCollector,
    macros: [],
    warnings: [],
    tocs: [],
    excerpts: new Map(),
    excerptIncludes: [],
    options,
  };

  let html = renderChildren($, root[0]!, ctx);
  const outline = outlineCollector.finalize();

  // Second pass: inline TOCs and same-page excerpt includes need the
  // fully-collected outline / excerpt registry.
  html = resolveTocMarkers(html, outline, ctx.tocs);
  html = resolveExcerptIncludes(html, ctx);

  return {
    html,
    outline,
    macros: ctx.macros,
    warnings: [...new Set(ctx.warnings)],
  };
}

// ----------------------------------------------------------------------
// Second-pass resolution
// ----------------------------------------------------------------------

function resolveTocMarkers(
  html: string,
  outline: OutlineNode[],
  tocs: TocRequest[],
): string {
  tocs.forEach((req, i) => {
    const marker = `<div class="cf-toc" data-toc-idx="${i}"></div>`;
    const replacement = `<div class="cf-toc" data-toc-idx="${i}">${renderTocHtml(outline, req)}</div>`;
    html = html.split(marker).join(replacement);
  });
  return html;
}

function renderTocHtml(outline: OutlineNode[], req: TocRequest): string {
  const inRange = (n: OutlineNode) => n.level >= req.min && n.level <= req.max;
  const link = (n: OutlineNode) =>
    `<a class="cf-link" href="#${escapeAttr(n.id)}">${escapeHtml(n.text)}</a>`;

  if (req.type === "flat") {
    const items: string[] = [];
    const walk = (nodes: OutlineNode[]) => {
      for (const n of nodes) {
        if (inRange(n)) items.push(`<li>${link(n)}</li>`);
        walk(n.children);
      }
    };
    walk(outline);
    return items.length
      ? `<ul class="cf-toc-list">${items.join("")}</ul>`
      : `<div class="cf-toc-empty">No headings in range</div>`;
  }

  const build = (nodes: OutlineNode[]): string => {
    let lis = "";
    for (const n of nodes) {
      const childHtml = build(n.children);
      if (inRange(n)) {
        lis += `<li>${link(n)}${childHtml}</li>`;
      } else if (childHtml) {
        lis += `<li class="cf-toc-promoted">${childHtml}</li>`;
      }
    }
    return lis ? `<ul class="cf-toc-list">${lis}</ul>` : "";
  };
  return build(outline) || `<div class="cf-toc-empty">No headings in range</div>`;
}

function resolveExcerptIncludes(html: string, ctx: RenderContext): string {
  ctx.excerptIncludes.forEach((req, i) => {
    const marker = `<div class="cf-excerpt-include" data-excerpt-idx="${i}"></div>`;
    const body = !req.crossPage ? ctx.excerpts.get(req.name) : undefined;
    let replacement: string;
    if (body !== undefined) {
      replacement =
        `<aside class="cf-excerpt cf-excerpt-included">` +
        `<div class="cf-excerpt-label">Excerpt: ${escapeHtml(req.name)}</div>` +
        `<div class="cf-excerpt-body">${body}</div></aside>`;
    } else {
      ctx.warnings.push(`Unresolved excerpt-include: ${req.name}`);
      replacement =
        `<aside class="cf-excerpt cf-excerpt-include">` +
        `<div class="cf-excerpt-label">Excerpt from “${escapeHtml(req.name)}”</div>` +
        `<div class="cf-excerpt-body">— not resolvable offline —</div></aside>`;
    }
    html = html.split(marker).join(replacement);
  });
  return html;
}