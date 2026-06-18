/**
 * Recursive renderer for standard HTML elements.
 *
 * Confluence Storage Format is XHTML + custom <ac:*> / <ri:*> elements.
 * This module handles the "standard HTML" subset: any element NOT handled
 * by a macro renderer falls through here.
 */

import * as cheerio from "cheerio";
import type { Cheerio, AnyNode } from "cheerio";
import { escapeHtml, escapeAttr } from "./sanitize";
import type { OutlineCollector } from "./types";
import { renderStructuredMacro, renderInlineMacro, renderAcLink } from "./macros/registry";

/**
 * Walk all children of `el` and produce their rendered HTML.
 * Text nodes are escaped; element nodes are routed through renderElement().
 */
export function renderChildren(
  $: cheerio.CheerioAPI,
  el: AnyNode,
  ctx: RenderContext,
): string {
  const children = $(el).contents();
  let out = "";
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    if (node.type === "text") {
      out += escapeHtml((node as any).data as string);
    } else if (node.type === "tag") {
      out += renderElement($, cheerio.default(node as any), ctx);
    }
    // Skip comments, CDATA, etc.
  }
  return out;
}

/**
 * Render a single cheerio element (already known to be a tag).
 */
export function renderElement(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: RenderContext,
): string {
  const tag = (el[0] as any).tagName?.toLowerCase() as string;

  // ---- Structured macros can appear inside <p> etc., so route them here. ----
  if (tag === "ac:structured-macro") {
    return renderStructuredMacro($, el, ctx);
  }
  if (tag === "ac:link") {
    return renderAcLink($, el, ctx);
  }
  if (
    tag.startsWith("ac:emoticon") ||
    tag.startsWith("ac:cheese") ||
    tag.startsWith("ac:macro-name")
  ) {
    return renderInlineMacro($, el, ctx);
  }
  if (tag.startsWith("ac:") || tag.startsWith("ri:")) {
    // Unknown AC/RI element: render its children inline as best-effort.
    return renderChildren($, el[0]!, ctx);
  }
  // cf-cdata placeholder from preprocessing — render nothing here.
  if (tag === "cf-cdata") {
    return "";
  }

  switch (tag) {
    case "br":
      return "<br/>";

    case "hr":
      return "<hr/>";

    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = parseInt(tag[1]!, 10);
      const text = el.text();
      const id = ctx.outline.collect(level, el, text);
      return `<h${level} id="${escapeAttr(id)}" class="cf-heading">${renderChildren(
        $,
        el[0]!,
        ctx,
      )}</h${level}>`;
    }

    case "p":
      return `<p class="cf-paragraph">${renderChildren($, el[0]!, ctx)}</p>`;

    case "strong":
    case "b":
      return `<strong>${renderChildren($, el[0]!, ctx)}</strong>`;

    case "em":
    case "i":
      return `<em>${renderChildren($, el[0]!, ctx)}</em>`;

    case "u":
      return `<u>${renderChildren($, el[0]!, ctx)}</u>`;

    case "s":
    case "strike":
    case "del":
      return `<s>${renderChildren($, el[0]!, ctx)}</s>`;

    case "sub":
      return `<sub>${renderChildren($, el[0]!, ctx)}</sub>`;
    case "sup":
      return `<sup>${renderChildren($, el[0]!, ctx)}</sup>`;

    case "code":
      // Inline code: must NOT contain block children
      return `<code class="cf-inline-code">${escapeHtml(el.text())}</code>`;

    case "pre":
      // Bare <pre> (no <ac:macro code>): treat as preformatted block
      return `<pre class="cf-pre">${escapeHtml(el.text())}</pre>`;

    case "blockquote":
      return `<blockquote class="cf-quote">${renderChildren($, el[0]!, ctx)}</blockquote>`;

    case "ul":
      return `<ul class="cf-list">${renderChildren($, el[0]!, ctx)}</ul>`;

    case "ol": {
      const start = el.attr("start");
      const startAttr = start ? ` start="${escapeAttr(start)}"` : "";
      return `<ol class="cf-list"${startAttr}>${renderChildren($, el[0]!, ctx)}</ol>`;
    }

    case "li":
      return `<li class="cf-list-item">${renderChildren($, el[0]!, ctx)}</li>`;

    case "a": {
      const href = el.attr("href") ?? "#";
      const safeHref = sanitizeHref(href);
      return `<a class="cf-link" href="${escapeAttr(safeHref)}" target="_blank" rel="noopener">${renderChildren(
        $,
        el[0]!,
        ctx,
      )}</a>`;
    }

    case "img": {
      const src = el.attr("src") ?? "";
      const alt = el.attr("alt") ?? "";
      const title = el.attr("title");
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      // Don't actually load external images in the webview (CSP + offline).
      // Show a placeholder.
      if (!src) return "";
      return `<span class="cf-image-placeholder"${titleAttr}><span class="cf-image-icon">🖼</span><span class="cf-image-alt">${escapeHtml(
        alt || src,
      )}</span></span>`;
    }

    case "table":
      return `<div class="cf-table-wrapper"><table class="cf-table">${renderChildren(
        $,
        el[0]!,
        ctx,
      )}</table></div>`;

    case "thead":
      return `<thead>${renderChildren($, el[0]!, ctx)}</thead>`;
    case "tbody":
      return `<tbody>${renderChildren($, el[0]!, ctx)}</tbody>`;
    case "tr":
      return `<tr>${renderChildren($, el[0]!, ctx)}</tr>`;
    case "th": {
      const attrs = collectCellAttrs(el);
      return `<th${attrs}>${renderChildren($, el[0]!, ctx)}</th>`;
    }
    case "td": {
      const attrs = collectCellAttrs(el);
      return `<td${attrs}>${renderChildren($, el[0]!, ctx)}</td>`;
    }

    case "span": {
      // Confluence uses <span class="toc-item-body"> as a layout hack.
      // Render its children inline; the class is preserved on a wrapper
      // so debug-time inspection still shows it.
      const cls = el.attr("class");
      const clsAttr = cls ? ` class="cf-span ${escapeAttr(cls)}"` : "";
      return `<span${clsAttr}>${renderChildren($, el[0]!, ctx)}</span>`;
    }

    case "div":
      return `<div class="cf-div">${renderChildren($, el[0]!, ctx)}</div>`;

    case "figure":
    case "figcaption":
      return `<${tag} class="cf-${tag}">${renderChildren($, el[0]!, ctx)}</${tag}>`;

    case "time":
    case "small":
    case "mark":
    case "cite":
    case "q":
    case "kbd":
      return `<${tag} class="cf-${tag}">${renderChildren($, el[0]!, ctx)}</${tag}>`;

    default:
      // Unknown element: render its children inline. Drop the wrapper.
      return renderChildren($, el[0]!, ctx);
  }
}

function collectCellAttrs(el: Cheerio<any>): string {
  const attrs: string[] = [];
  const colspan = el.attr("colspan");
  if (colspan) attrs.push(`colspan="${escapeAttr(colspan)}"`);
  const rowspan = el.attr("rowspan");
  if (rowspan) attrs.push(`rowspan="${escapeAttr(rowspan)}"`);
  const style = el.attr("style");
  if (style) attrs.push(`style="${escapeAttr(style)}"`);
  const cls = el.attr("class");
  if (cls) attrs.push(`class="${escapeAttr(cls)}"`);
  return attrs.length ? " " + attrs.join(" ") : "";
}

function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return "#";
  }
  return trimmed;
}

/**
 * Shared context passed down through recursion.
 */
export interface RenderContext {
  outline: OutlineCollector;
}