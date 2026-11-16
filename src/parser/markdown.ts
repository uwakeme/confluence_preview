/**
 * Confluence Storage Format → Markdown (GFM-flavored).
 *
 * Tree-based conversion sharing the same cheerio parse as the HTML
 * renderer, so nested macros, tables, task lists and CDATA survive.
 * Best-effort and not round-trippable, but structurally faithful.
 */

import * as cheerio from "cheerio";
import type { Cheerio, AnyNode } from "cheerio";
import { loadDocument, extractCdata, readMacroParams, richBody, plainBody } from "./source";
import type { ParseOptions } from "./types";
import { buildPageUrl, buildJiraUrl, sanitizeHref } from "../links";
import { EMOJI } from "./macros/emoticon";

interface MdCtx {
  options: ParseOptions;
  excerpts: Map<string, string>;
  /** Inside a table cell: blocks flatten, newlines become <br>. */
  inCell: boolean;
}

export function confluenceToMarkdown(
  source: string,
  options: ParseOptions = {},
): string {
  const { $, root } = loadDocument(source);
  const ctx: MdCtx = { options, excerpts: new Map(), inCell: false };

  // Pre-register excerpt bodies so excerpt-include can resolve them
  // regardless of definition order.
  root.find("ac\\:structured-macro").each((_, node) => {
    const el = $(node);
    if ((el.attr("ac:name") ?? "").toLowerCase() !== "excerpt") return;
    const params = readMacroParams($, el);
    const name = (params["name"] ?? "").trim() || "default";
    const rich = richBody($, el);
    if (rich.length > 0) ctx.excerpts.set(name, mdChildren($, rich[0]!, ctx).trim());
  });

  const md = mdChildren($, root[0]!, ctx);
  return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ----------------------------------------------------------------------
// Node walking
// ----------------------------------------------------------------------

function mdChildren($: cheerio.CheerioAPI, el: AnyNode, ctx: MdCtx): string {
  let out = "";
  const children = $(el).contents();
  for (let i = 0; i < children.length; i++) {
    out += mdNode($, children[i]!, ctx);
  }
  return out;
}

function mdNode($: cheerio.CheerioAPI, node: AnyNode, ctx: MdCtx): string {
  if (node.type === "text") return escapeMd(String((node as any).data ?? ""));
  if (node.type !== "tag") return "";
  return mdElement($, cheerio.default(node as any), ctx);
}

function block(inner: string, ctx: MdCtx): string {
  const text = inner.trim();
  if (!text) return "";
  // In cells, single newlines keep blocks apart; mdTable turns them into <br>.
  return ctx.inCell ? `\n${text}\n` : `\n\n${text}\n\n`;
}

function mdElement(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: MdCtx,
): string {
  const tag = (el[0] as any).tagName?.toLowerCase() as string;

  if (tag === "ac:structured-macro") return mdMacro($, el, ctx);
  if (tag === "ac:link") return mdAcLink($, el, ctx);
  if (tag === "ac:image") return mdAcImage($, el, ctx);
  if (tag === "ac:emoticon") return emoticonGlyph(el);
  if (tag === "ac:task-list") return mdTaskList($, el, ctx);
  if (tag === "ac:task") return mdTask($, el, ctx);
  if (tag === "ac:layout" || tag === "ac:layout-section" || tag === "ac:layout-cell") {
    return block(mdChildren($, el[0]!, ctx), ctx);
  }
  if (tag.startsWith("ac:") || tag.startsWith("ri:")) {
    return mdChildren($, el[0]!, ctx);
  }
  if (tag === "cf-cdata") return "";

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = parseInt(tag[1]!, 10);
      return block(`${"#".repeat(level)} ${mdChildren($, el[0]!, ctx).trim()}`, ctx);
    }
    case "p":
      return block(mdChildren($, el[0]!, ctx), ctx);
    case "br":
      return ctx.inCell ? "<br>" : "  \n";
    case "hr":
      return block("---", ctx);
    case "strong":
    case "b":
      return `**${mdChildren($, el[0]!, ctx)}**`;
    case "em":
    case "i":
      return `*${mdChildren($, el[0]!, ctx)}*`;
    case "s":
    case "strike":
    case "del":
      return `~~${mdChildren($, el[0]!, ctx)}~~`;
    case "code": {
      const text = el.text();
      const wrap = text.includes("`") ? "``" : "`";
      return `${wrap}${text}${wrap}`;
    }
    case "pre":
      return block(fence(el.text(), ""), ctx);
    case "blockquote":
      return block(quoteLines(mdChildren($, el[0]!, ctx)), ctx);
    case "ul":
      return mdList($, el, ctx, false);
    case "ol":
      return mdList($, el, ctx, true);
    case "li":
      return block(`- ${mdChildren($, el[0]!, ctx).trim()}`, ctx);
    case "a": {
      const href = sanitizeHref(el.attr("href") ?? "#");
      const text = mdChildren($, el[0]!, ctx).trim() || href;
      if (href === "#") return text;
      return `[${text}](${href})`;
    }
    case "img": {
      const src = el.attr("src") ?? "";
      const alt = el.attr("alt") ?? "";
      return src ? `![${escapeMd(alt)}](${src})` : "";
    }
    case "table":
      return mdTable($, el, ctx);
    case "div":
    case "figure":
      return block(mdChildren($, el[0]!, ctx), ctx);
    case "figcaption":
      return block(`*${mdChildren($, el[0]!, ctx).trim()}*`, ctx);
    case "thead":
    case "tbody":
    case "tfoot":
    case "tr":
    case "th":
    case "td":
    case "colgroup":
    case "col":
      // Handled by mdTable; stray cells outside a table degrade to text.
      return mdChildren($, el[0]!, ctx);
    default:
      return mdChildren($, el[0]!, ctx);
  }
}

// ----------------------------------------------------------------------
// Macros
// ----------------------------------------------------------------------

function mdMacro($: cheerio.CheerioAPI, el: Cheerio<any>, ctx: MdCtx): string {
  const name = (el.attr("ac:name") ?? "").toLowerCase();
  const params = readMacroParams($, el);
  const rich = richBody($, el);
  const body = rich.length > 0 ? mdChildren($, rich[0]!, ctx).trim() : "";
  const cdata = plainBody($, el);

  switch (name) {
    case "code": {
      const lang = (params["language"] ?? params["lang"] ?? "").trim();
      const title = params["title"] ?? params["caption"];
      const code = fence(cdata.replace(/^\n+|\n+$/g, ""), lang);
      return block(title ? `**${escapeMd(title)}**\n\n${code}` : code, ctx);
    }
    case "noformat":
      return block(fence(cdata.replace(/^\n+|\n+$/g, ""), ""), ctx);
    case "note":
    case "info":
    case "warning":
    case "tip": {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      const title = params["title"];
      const head = title ? `**${escapeMd(title)}**` : `**${label}**`;
      return block(quoteLines(`${head}\n\n${body}`), ctx);
    }
    case "panel":
    case "quote":
      return block(quoteLines(body), ctx);
    case "expand": {
      const title = escapeMd(params["title"] ?? "Click to expand...");
      return block(`<details>\n<summary>${title}</summary>\n\n${body}\n\n</details>`, ctx);
    }
    case "status": {
      const display = params["title"] ?? (body || "Status");
      return `**${escapeMd(display)}**`;
    }
    case "toc":
    case "table-of-contents":
    case "table-of-content":
      return "";
    case "excerpt":
      return isTruthy(params["hidden"]) ? "" : block(body, ctx);
    case "excerpt-include": {
      const ref = (params["name"] ?? params["ref"] ?? "").trim() || "default";
      const page = el.children("ri\\:page").first();
      const crossPage = page.length > 0 && !!page.attr("ri:content-title");
      const resolved = !crossPage ? ctx.excerpts.get(ref) : undefined;
      if (resolved !== undefined) return block(resolved, ctx);
      return block(`> Excerpt from “${escapeMd(ref)}” — not resolvable offline`, ctx);
    }
    case "children":
      return block("*(Child pages — not resolvable offline)*", ctx);
    case "jira": {
      const key = (params["key"] ?? "").trim() || "PROJ-1";
      const href = buildJiraUrl(params["baseurl"] ?? ctx.options.jiraBaseUrl, key);
      return href ? `[🎫 ${escapeMd(key)}](${href})` : `🎫 ${escapeMd(key)}`;
    }
    case "user-mention": {
      const display =
        params["display-name"] ?? params["displayname"] ??
        params["username"] ?? params["account-id"] ?? params["accountid"] ?? "user";
      return `@${escapeMd(display)}`;
    }
    case "anchor": {
      const anchor = (params["anchor-name"] ?? params["anchor"] ?? params[""] ?? "").trim();
      return anchor ? `<a id="${anchor}"></a>` : "";
    }
    case "section":
    case "column":
      return block(body, ctx);
    case "emoticon":
    case "cheese":
      return emoticonGlyph(el, params);
    case "link":
    case "pagelink": {
      const href = sanitizeHref(params["url"] ?? params["href"] ?? "#");
      const text = body || escapeMd(cdata.trim()) || escapeMd(params["anchor"] ?? href);
      return href === "#" ? text : `[${text}](${href})`;
    }
    default:
      if (body) return block(body, ctx);
      if (cdata.trim()) return block(fence(cdata, ""), ctx);
      return block(`*(${escapeMd(name || "unknown")} macro)*`, ctx);
  }
}

function mdAcLink($: cheerio.CheerioAPI, el: Cheerio<any>, ctx: MdCtx): string {
  const anchor = el.attr("ac:anchor") ?? "";
  const plain = el.children("ac\\:plain-text-link-body").first();
  const rich = el.children("ac\\:link-body").first();
  const custom =
    plain.length > 0
      ? escapeMd(extractCdata(plain).trim())
      : rich.length > 0
        ? mdChildren($, rich[0]!, ctx).trim()
        : "";

  const page = el.children("ri\\:page").first();
  if (page.length > 0) {
    const title = page.attr("ri:content-title") ?? "Page";
    const url = buildPageUrl(ctx.options.baseUrl, page.attr("ri:space-key"), title, anchor || undefined);
    const text = custom || escapeMd(title);
    return url ? `[${text}](${url})` : text;
  }
  const att = el.children("ri\\:attachment").first();
  if (att.length > 0) {
    const filename = att.attr("ri:filename") ?? "attachment";
    return `[${custom || `📎 ${escapeMd(filename)}`}](${encodeURI(filename)})`;
  }
  const url = el.children("ri\\:url").first();
  if (url.length > 0) {
    const href = sanitizeHref(url.attr("ri:value") ?? "#");
    return `[${custom || escapeMd(href)}](${href})`;
  }
  const user = el.children("ri\\:user").first();
  if (user.length > 0) return "@user";
  if (anchor) return `[${custom || escapeMd(anchor)}](#${anchor})`;
  return custom || mdChildren($, el[0]!, ctx);
}

function mdAcImage($: cheerio.CheerioAPI, el: Cheerio<any>, ctx: MdCtx): string {
  const att = el.children("ri\\:attachment").first();
  const url = el.children("ri\\:url").first();
  const alt = el.attr("ac:alt") ?? "";
  const src =
    att.length > 0
      ? encodeURI(att.attr("ri:filename") ?? "")
      : url.length > 0
        ? url.attr("ri:value") ?? ""
        : "";
  if (!src) return "";
  const caption = el.children("ac\\:caption").first();
  const capText = caption.length > 0 ? mdChildren($, caption[0]!, ctx).trim() : "";
  const img = `![${escapeMd(alt)}](${src})`;
  return capText ? block(`${img}\n\n*${capText}*`, ctx) : img;
}

function mdTaskList($: cheerio.CheerioAPI, el: Cheerio<any>, ctx: MdCtx): string {
  return block(mdChildren($, el[0]!, ctx), ctx);
}

function mdTask($: cheerio.CheerioAPI, el: Cheerio<any>, ctx: MdCtx): string {
  const status = el.children("ac\\:task-status").first().text().trim().toLowerCase();
  const body = el.children("ac\\:task-body").first();
  const text = body.length > 0 ? mdChildren($, body[0]!, ctx).trim() : "";
  const mark = status === "complete" ? "x" : " ";
  if (ctx.inCell) return `[${mark}] ${text}`;
  return `\n- [${mark}] ${text}`;
}

// ----------------------------------------------------------------------
// Tables / lists
// ----------------------------------------------------------------------

function mdTable($: cheerio.CheerioAPI, el: Cheerio<any>, ctx: MdCtx): string {
  const rows: { cells: string[]; aligns: string[]; header: boolean }[] = [];
  // Only this table's own rows — a nested table inside a cell must not
  // contribute its rows to the outer table.
  const trs: any[] = [];
  el.children().each((_, child) => {
    const t = (child as any).tagName?.toLowerCase();
    if (t === "tr") trs.push(child);
    else if (t === "thead" || t === "tbody" || t === "tfoot") {
      $(child).children("tr").each((_, tr) => { trs.push(tr); });
    }
  });
  trs.forEach((tr) => {
    const cells: string[] = [];
    const aligns: string[] = [];
    let header = false;
    $(tr)
      .children("th,td")
      .each((_, cell) => {
        const ce = $(cell);
        if (cell.tagName.toLowerCase() === "th") header = true;
        const cellCtx: MdCtx = { ...ctx, inCell: true };
        let text = mdChildren($, cell, cellCtx).trim();
        text = text.replace(/\n{2,}/g, "<br>").replace(/\n/g, "<br>").replace(/\|/g, "\\|");
        cells.push(text);
        const align = /text-align:\s*(center|right|left)/i.exec(ce.attr("style") ?? "");
        aligns.push(align ? align[1]!.toLowerCase() : "left");
      });
    if (cells.length > 0) rows.push({ cells, aligns, header });
  });
  if (rows.length === 0) return "";

  const width = Math.max(...rows.map((r) => r.cells.length));
  const pad = <T extends { cells: string[] }>(r: T): T => {
    while (r.cells.length < width) r.cells.push("");
    return r;
  };
  const headerRow = pad(rows[0]!);
  const bodyRows = rows.slice(1).map(pad);
  const alignCell = (a: string) =>
    a === "center" ? ":---:" : a === "right" ? "---:" : "---";
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;

  const out = [
    line(headerRow.cells),
    line(headerRow.aligns.map(alignCell)),
    ...bodyRows.map((r) => line(r.cells)),
  ].join("\n");
  return block(out, ctx);
}

function mdList(
  $: cheerio.CheerioAPI,
  el: Cheerio<any>,
  ctx: MdCtx,
  ordered: boolean,
): string {
  const startRaw = parseInt(el.attr("start") ?? "1", 10);
  let counter = Number.isFinite(startRaw) ? startRaw : 1;
  const items: string[] = [];
  el.children("li").each((_, li) => {
    const marker = ordered ? `${counter}. ` : "- ";
    counter++;
    const pad = " ".repeat(marker.length);
    const content = mdChildren($, li, ctx).trim();
    const lines = content.split("\n");
    const rendered = lines
      .map((l, i) => {
        if (i === 0) return marker + l;
        return l.trim() ? pad + l : "";
      })
      .join("\n");
    items.push(rendered);
  });
  if (items.length === 0) return "";
  return block(items.join("\n"), ctx);
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function fence(code: string, lang: string): string {
  const ticks = code.includes("```") ? "````" : "```";
  return `${ticks}${lang}\n${code}\n${ticks}`;
}

function quoteLines(md: string): string {
  return md
    .trim()
    .split("\n")
    .map((l) => (l.trim() ? `> ${l}` : ">"))
    .join("\n");
}

function escapeMd(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, (c) => `\\${c}`);
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}

function emoticonGlyph(el: Cheerio<any>, params?: Record<string, string>): string {
  const raw = (
    params?.["name"] ??
    el.attr("ac:name") ??
    (el[0] as any).tagName?.replace(/^ac:/, "") ??
    ""
  ).toLowerCase();
  return EMOJI[raw] ?? EMOJI[raw.replace(/-/g, "_")] ?? "🙂";
}