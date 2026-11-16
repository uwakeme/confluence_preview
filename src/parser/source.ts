/**
 * Source loading shared by the HTML renderer and the Markdown exporter:
 * CDATA preprocessing + cheerio parse + macro parameter reading.
 */

import * as cheerio from "cheerio";

/**
 * Replace <![CDATA[...]]> blocks with placeholder elements carrying
 * base64-encoded content. cheerio's HTML parser turns CDATA into comments
 * per HTML5 spec, which would lose code-block content. The placeholder
 * survives the parse and is decoded back by `extractCdata`.
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
 * Given a parsed element containing a CDATA placeholder, return the raw
 * CDATA text. Falls back to the element's text content when absent.
 */
export function extractCdata(el: cheerio.Cheerio<any>): string {
  const span = el.find("cf-cdata").first();
  if (span.length === 0) return el.text();
  const b64 = span.attr("data-b64") ?? "";
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Storage format is XHTML: custom tags like <ri:page …/> are self-closing.
 * cheerio's HTML parser ignores the slash on unknown elements and lets them
 * swallow following siblings, so expand them to explicit open/close pairs.
 * Runs AFTER CDATA replacement so code samples are never touched.
 */
function expandSelfClosingCustomTags(source: string): string {
  return source.replace(
    /<(ac|ri):([\w-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)\/>/g,
    (_m, ns: string, name: string, attrs: string) =>
      `<${ns}:${name}${attrs}></${ns}:${name}>`,
  );
}

/**
 * Parse the source into a cheerio tree wrapped in a #cf-root fragment.
 */
export function loadDocument(source: string): {
  $: cheerio.CheerioAPI;
  root: cheerio.Cheerio<any>;
} {
  const preprocessed = expandSelfClosingCustomTags(preprocessCdata(source));
  const wrapped = `<div id="cf-root">${preprocessed}</div>`;
  const $ = cheerio.load(wrapped, { xmlMode: false, decodeEntities: true });
  return { $, root: $("#cf-root").first() };
}

/**
 * Read a macro's DIRECT-child parameters (nested macros keep their own),
 * decoding CDATA-wrapped values.
 */
export function readMacroParams(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
): Record<string, string> {
  const params: Record<string, string> = {};
  el.children("ac\\:parameter").each((_, p) => {
    const pe = $(p);
    const name = pe.attr("ac:name") ?? pe.attr("name") ?? "";
    params[name] = pe.find("cf-cdata").length > 0 ? extractCdata(pe) : pe.text();
  });
  return params;
}

/** Direct-child rich-text-body element, if any. */
export function richBody(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
): cheerio.Cheerio<any> {
  return el.children("ac\\:rich-text-body").first();
}

/** Direct-child plain-text-body raw CDATA, if any. */
export function plainBody(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
): string {
  const body = el.children("ac\\:plain-text-body").first();
  return body.length > 0 ? extractCdata(body) : "";
}