/**
 * Recursive renderer for standard HTML elements.
 *
 * Confluence Storage Format is XHTML + custom <ac:*> / <ri:*> elements.
 * This module handles the "standard HTML" subset plus the ac:* elements
 * that are not structured macros (image, task-list, layout, …).
 */

import * as cheerio from "cheerio";
import type { Cheerio, AnyNode } from "cheerio";
import {
  escapeHtml,
  escapeAttr,
  contrastText,
  isCssColor,
  isCssLength,
  sanitizeStyle,
  styleAttr,
} from "./sanitize";
import type { OutlineCollector, ParseOptions } from "./types";
import { sanitizeHref } from "../links";
import { renderStructuredMacro, renderInlineMacro, renderAcLink } from "./macros/registry";

const INLINE_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "text-decoration",
  "font-weight",
  "font-style",
]);
const BLOCK_STYLE_PROPS = new Set([...INLINE_STYLE_PROPS, "text-align"]);
const CELL_STYLE_PROPS = new Set([
  ...BLOCK_STYLE_PROPS,
  "width",
  "height",
  "vertical-align",
]);

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

  // ---- Confluence-specific elements that are not structured macros. ----
  if (tag === "ac:structured-macro") {
    return renderStructuredMacro($, el, ctx);
  }
  if (tag === "ac:link") {
    return renderAcLink($, el, ctx);
  }
  if (tag === "ac:emoticon") {
    return renderInlineMacro($, el, ctx);
  }
  if (tag === "ac:image") {
    return renderAcImage($, el, ctx);
  }
  if (tag === "ac:task-list" || tag === "ac:task") {
    return renderTask($, el, ctx, tag);
  }
  if (tag === "ac:layout" || tag === "ac:layout-section" || tag === "ac:layout-cell") {
    return renderLayout($, el, ctx, tag);
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
      const style = styleAttr(sanitizeStyle(el.attr("style"), BLOCK_STYLE_PROPS));
      return `<h${level} id="${escapeAttr(id)}" class="cf-heading"${style}>${renderChildren(
        $,
        el[0]!,
        ctx,
      )}</h${level}>`;
    }

    case "p": {
      const style = styleAttr(sanitizeStyle(el.attr("style"), BLOCK_STYLE_PROPS));
      return `<p class="cf-paragraph"${style}>${renderChildren($, el[0]!, ctx)}</p>`;
    }

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
      const startAttr = start && /^\d+$/.test(start) ? ` start="${start}"` : "";
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

    case "img":
      return renderImg($, el, ctx);

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
    case "tfoot":
      return `<tfoot>${renderChildren($, el[0]!, ctx)}</tfoot>`;
    case "colgroup":
      return `<colgroup>${renderChildren($, el[0]!, ctx)}</colgroup>`;
    case "col": {
      const attrs: string[] = [];
      const span = el.attr("span");
      if (span && /^\d+$/.test(span)) attrs.push(`span="${span}"`);
      const width = el.attr("width");
      if (width && isCssLength(width)) attrs.push(`style="width: ${escapeAttr(width)}"`);
      return `<col${attrs.length ? " " + attrs.join(" ") : ""}/>`;
    }
    case "tr":
      return `<tr>${renderChildren($, el[0]!, ctx)}</tr>`;
    case "th": {
      const attrs = collectCellAttrs(el, true);
      return `<th${attrs}>${renderChildren($, el[0]!, ctx)}</th>`;
    }
    case "td": {
      const attrs = collectCellAttrs(el, false);
      return `<td${attrs}>${renderChildren($, el[0]!, ctx)}</td>`;
    }

    case "span": {
      const cls = el.attr("class");
      const clsAttr = cls ? ` class="cf-span ${escapeAttr(cls)}"` : "";
      const style = styleAttr(sanitizeStyle(el.attr("style"), INLINE_STYLE_PROPS));
      return `<span${clsAttr}${style}>${renderChildren($, el[0]!, ctx)}</span>`;
    }

    case "div": {
      const style = styleAttr(sanitizeStyle(el.attr("style"), BLOCK_STYLE_PROPS));
      return `<div class="cf-div"${style}>${renderChildren($, el[0]!, ctx)}</div>`;
    }

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

// ----------------------------------------------------------------------
// Confluence-specific element renderers
// ----------------------------------------------------------------------

function renderAcImage(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: RenderContext,
): string {
  const att = el.children("ri\\:attachment").first();
  const url = el.children("ri\\:url").first();
  const filename = att.length > 0 ? att.attr("ri:filename") ?? "" : "";
  const remoteUrl = url.length > 0 ? url.attr("ri:value") ?? "" : "";

  const alt = el.attr("ac:alt") ?? "";
  const title = el.attr("ac:title");
  const width = numericAttr(el.attr("ac:width"));
  const height = numericAttr(el.attr("ac:height"));
  const bordered = el.attr("ac:border") === "true";
  const thumbnail = el.attr("ac:thumbnail") === "true";

  const captionEl = el.children("ac\\:caption").first();
  const caption =
    captionEl.length > 0 ? renderChildren($, captionEl[0]!, ctx) : "";

  const dims =
    (width ? ` width="${width}"` : "") + (height ? ` height="${height}"` : "");
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  const cls = `cf-image${bordered ? " cf-image-bordered" : ""}`;

  let inner: string;
  const localSrc = filename
    ? ctx.options.resolveLocalFile?.(filename)
    : undefined;
  if (localSrc) {
    inner = `<img class="${cls}" src="${escapeAttr(localSrc)}" alt="${escapeAttr(
      alt || filename,
    )}"${dims}${titleAttr}/>`;
  } else {
    const label = alt || filename || remoteUrl || "image";
    const note = thumbnail ? " (thumbnail)" : "";
    const hint = filename
      ? "Attachment not found next to the source file"
      : "External image (not loaded offline)";
    const phTitle = title ? `${title} — ${hint}` : hint;
    inner =
      `<span class="cf-image-placeholder" title="${escapeAttr(phTitle)}">` +
      `<span class="cf-image-icon">🖼</span>` +
      `<span class="cf-image-alt">${escapeHtml(label)}${escapeHtml(note)}</span>` +
      (width || height
        ? `<span class="cf-image-dims">${width || "?"}×${height || "?"}</span>`
        : "") +
      `</span>`;
  }

  if (caption) {
    return `<figure class="cf-figure">${inner}<figcaption class="cf-figcaption">${caption}</figcaption></figure>`;
  }
  return inner;
}

function renderImg(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: RenderContext,
): string {
  const src = el.attr("src") ?? "";
  const alt = el.attr("alt") ?? "";
  const title = el.attr("title");
  if (!src) return "";
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  const dims =
    (numericAttr(el.attr("width")) ? ` width="${numericAttr(el.attr("width"))}"` : "") +
    (numericAttr(el.attr("height")) ? ` height="${numericAttr(el.attr("height"))}"` : "");

  if (/^data:image\//i.test(src)) {
    return `<img class="cf-image" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${dims}${titleAttr}/>`;
  }
  // Relative/local path: try to resolve against the source file's folder.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(src)) {
    const local = ctx.options.resolveLocalFile?.(src);
    if (local) {
      return `<img class="cf-image" src="${escapeAttr(local)}" alt="${escapeAttr(alt)}"${dims}${titleAttr}/>`;
    }
  }
  // External images are intentionally not loaded (CSP + offline promise).
  return (
    `<span class="cf-image-placeholder"${titleAttr}>` +
    `<span class="cf-image-icon">🖼</span>` +
    `<span class="cf-image-alt">${escapeHtml(alt || src)}</span></span>`
  );
}

function renderTask(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: RenderContext,
  tag: string,
): string {
  if (tag === "ac:task-list") {
    return `<ul class="cf-task-list">${renderChildren($, el[0]!, ctx)}</ul>`;
  }
  const status = el.children("ac\\:task-status").first().text().trim().toLowerCase();
  const body = el.children("ac\\:task-body").first();
  const checked = status === "complete" ? " checked" : "";
  const bodyHtml = body.length > 0 ? renderChildren($, body[0]!, ctx) : "";
  return (
    `<li class="cf-task"><input type="checkbox" class="cf-task-checkbox" disabled${checked}/>` +
    `<span class="cf-task-body">${bodyHtml}</span></li>`
  );
}

const LAYOUT_TYPES = new Set([
  "single",
  "two_equal",
  "three_equal",
  "two_left_sidebar",
  "two_right_sidebar",
  "three_with_sidebars",
]);

function renderLayout(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: RenderContext,
  tag: string,
): string {
  if (tag === "ac:layout") {
    return `<div class="cf-layout">${renderChildren($, el[0]!, ctx)}</div>`;
  }
  if (tag === "ac:layout-section") {
    const rawType = el.attr("ac:type") ?? "single";
    const type = LAYOUT_TYPES.has(rawType) ? rawType : "single";
    return `<div class="cf-layout-section" data-type="${type}">${renderChildren(
      $,
      el[0]!,
      ctx,
    )}</div>`;
  }
  return `<div class="cf-layout-cell">${renderChildren($, el[0]!, ctx)}</div>`;
}

// ----------------------------------------------------------------------

function numericAttr(value: string | undefined): string {
  return value && /^\d+$/.test(value.trim()) ? value.trim() : "";
}

function collectCellAttrs(el: Cheerio<any>, isHeader: boolean): string {
  const attrs: string[] = [];
  const colspan = el.attr("colspan");
  if (colspan && /^\d+$/.test(colspan)) attrs.push(`colspan="${colspan}"`);
  const rowspan = el.attr("rowspan");
  if (rowspan && /^\d+$/.test(rowspan)) attrs.push(`rowspan="${rowspan}"`);
  if (isHeader) {
    const scope = el.attr("scope");
    if (scope && /^(row|col|rowgroup|colgroup)$/.test(scope)) {
      attrs.push(`scope="${scope}"`);
    }
  }

  let style = sanitizeStyle(el.attr("style"), CELL_STYLE_PROPS);
  const highlight = el.attr("data-highlight-colour");
  if (highlight && isCssColor(highlight)) {
    style =
      `background-color: ${highlight.trim()}; color: ${contrastText(highlight)}` +
      (style ? "; " + style : "");
  }
  if (style) attrs.push(`style="${escapeAttr(style)}"`);

  const cls = el.attr("class");
  if (cls) attrs.push(`class="${escapeAttr(cls)}"`);
  return attrs.length ? " " + attrs.join(" ") : "";
}

/**
 * Shared context passed down through recursion.
 */
export interface RenderContext {
  outline: OutlineCollector;
  /** Every macro name encountered, including nested ones. */
  macros: string[];
  /** Non-fatal diagnostics (unknown macros, …). */
  warnings: string[];
  /** Inline TOC macros awaiting the finalized outline (second pass). */
  tocs: TocRequest[];
  /** Excerpt bodies defined in this document, keyed by excerpt name. */
  excerpts: Map<string, string>;
  /** excerpt-include markers awaiting resolution (second pass). */
  excerptIncludes: ExcerptIncludeRequest[];
  options: ParseOptions;
}

export interface TocRequest {
  min: number;
  max: number;
  type: string;
}

export interface ExcerptIncludeRequest {
  name: string;
  crossPage: boolean;
}