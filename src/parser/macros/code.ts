/**
 * <ac:structured-macro ac:name="code"> — code block with syntax highlighting.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  objc: "objectivec",
  "c++": "cpp",
  "c#": "csharp",
  py: "python",
  rb: "ruby",
};

export function renderCodeMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  rawCdata: string,
): string {
  const rawLang = (params["language"] ?? params["lang"] ?? "").trim().toLowerCase();
  const language = LANG_ALIASES[rawLang] ?? (rawLang || "plaintext");
  const title = params["title"] ?? params["caption"];
  const collapse = isTruthy(params["collapse"]);
  const linenumbers = isTruthy(params["linenumbers"] ?? params["firstline"]);

  // rawCdata is the original CDATA text — preserve indentation.
  let codeText = rawCdata;
  // Trim leading/trailing newlines but preserve interior indentation
  codeText = codeText.replace(/^\n+/, "").replace(/\n+$/, "");

  if (collapse) {
    return (
      `<details class="cf-code cf-code-collapsible">` +
      `<summary class="cf-code-summary">${escapeHtml(title || language)}${
        title ? ` <span class="cf-code-lang">${escapeHtml(language)}</span>` : ""
      }</summary>` +
      `<pre class="cf-code-pre"><code class="language-${escapeAttr(
        language,
      )} hljs" data-linenumbers="${linenumbers ? "1" : "0"}">${escapeHtml(codeText)}</code></pre>` +
      `</details>`
    );
  }

  const titleHtml = title
    ? `<div class="cf-code-title">${escapeHtml(title)}</div>`
    : "";
  return (
    `<div class="cf-code">${titleHtml}` +
    `<pre class="cf-code-pre"><code class="language-${escapeAttr(
      language,
    )} hljs" data-linenumbers="${linenumbers ? "1" : "0"}">${escapeHtml(codeText)}</code></pre>` +
    `</div>`
  );
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}