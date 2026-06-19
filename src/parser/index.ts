/**
 * Confluence Storage Format parser.
 *
 * Public API: parseConfluence(source) → ParseResult
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "cheerio";
import { makeOutlineCollector } from "./outline";
import type { OutlineNode } from "./outline";
import { renderElement, renderChildren } from "./elements";
import type { RenderContext } from "./elements";
import { renderStructuredMacro, renderInlineMacro, renderAcLink } from "./macros/registry";
import type { ParseResult } from "./types";

export type { ParseResult } from "./types";
export type { OutlineNode } from "./outline";

/**
 * Preprocess the source: replace <![CDATA[...]]> blocks with placeholder
 * elements carrying base64-encoded content. cheerio's HTML parser turns
 * CDATA into comments per HTML5 spec, which would lose code-block content
 * for code macros etc. The placeholder survives cheerio's parse and is
 * later decoded back to the raw text by `extractCdata`.
 *
 * We use a self-contained element (`<cf-cdata>`) which we never render as
 * HTML — its data-b64 attribute is the only thing that matters.
 */
function preprocessCdata(source: string): string {
  return source.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
    (_m, content: string) => {
      const b64 = Buffer.from(content, "utf8").toString("base64");
      return `<cf-cdata data-b64="${b64}"></cf-cdata>`;
    },
  );
}

/**
 * Given a parsed plain-text-body element, return the raw CDATA text.
 * After preprocessing, the only child is a `<cf-cdata data-b64="…">` span.
 */
export function extractCdata(plainBodyEl: cheerio.Cheerio<any>): string {
  const span = plainBodyEl.find("cf-cdata").first();
  if (span.length === 0) {
    // No preprocessing placeholder found — fall back to raw text content.
    return plainBodyEl.text();
  }
  const b64 = span.attr("data-b64") ?? "";
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function parseConfluence(source: string): ParseResult {
  const trimmed = source.trim();
  const warnings: string[] = [];

  // Wrap in a fragment so cheerio parses correctly even if the user
  // provides a partial document.
  const preprocessed = preprocessCdata(trimmed);
  const wrapped = `<div id="cf-root">${preprocessed}</div>`;

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(wrapped, {
      xmlMode: false,
      decodeEntities: true,
    });
  } catch (e: any) {
    $ = cheerio.load(wrapped, { xmlMode: true, decodeEntities: true });
    warnings.push(`HTML parse fallback to XML mode: ${e?.message ?? e}`);
  }

  const root = $("#cf-root").first();

  const outlineCollector = makeOutlineCollector();
  const ctx: RenderContext = { outline: outlineCollector };
  const macros: string[] = [];

  // Walk top-level children of the root, ignoring the wrapper itself.
  let html = "";
  root.contents().each((_, node) => {
    if (node.type === "text") {
      html += escapeTextNode(node as any);
      return;
    }
    if (node.type !== "tag") return;
    const tag = (node as any).tagName?.toLowerCase() as string;

    if (tag === "ac:structured-macro") {
      const name = ($(node as any).attr("ac:name") ?? "").toLowerCase();
      if (name) macros.push(name);
      html += renderStructuredMacro($, $(node as any), ctx);
      return;
    }

    if (tag === "ac:link") {
      html += renderAcLink($, $(node as any), ctx);
      return;
    }

    // Inline macros: <ac:emoticon/>, <ac:macro-name/>, etc.
    if (
      tag.startsWith("ac:emoticon") ||
      tag.startsWith("ac:cheese") ||
      tag.startsWith("ac:macro-name") ||
      tag === "ac:link"
    ) {
      html += renderInlineMacro($, $(node as any), ctx);
      return;
    }

    // ri:* elements outside ac:link: render their text inline as best-effort.
    if (tag.startsWith("ri:")) {
      html += String((node as any).data ?? "");
      return;
    }

    // cf-cdata placeholder shouldn't appear at the top level, but defend
    // anyway: emit nothing (the parent will have decoded it).
    if (tag === "cf-cdata") {
      return;
    }

    html += renderElement($, $(node as any), ctx);
  });

  const outline = outlineCollector.finalize();

  return { html, outline, macros, warnings };
}

function escapeTextNode(node: AnyNode): string {
  if ((node as any).type === "text") {
    return String((node as any).data ?? "");
  }
  return "";
}