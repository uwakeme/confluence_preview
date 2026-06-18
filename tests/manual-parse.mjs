/**
 * Smoke test: parse the demo .confluence file and emit the HTML + outline
 * for human inspection. Not part of the published extension.
 *
 * Run with: node --import tsx tests/manual-parse.ts
 *   or:    node tests/manual-parse.js  (after build)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseConfluence } from "../src/parser/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const samplePath = join(root, "samples", "demo.confluence");

const source = readFileSync(samplePath, "utf8");
const result = parseConfluence(source);

console.log("=== macros seen ===");
console.log(result.macros);

console.log("\n=== outline ===");
function dump(o, depth = 0) {
  for (const n of o) {
    console.log("  ".repeat(depth) + "- h" + n.level + "  " + n.text + "  #" + n.id);
    dump(n.children, depth + 1);
  }
}
dump(result.outline);

console.log("\n=== html (preview, first 800 chars) ===");
console.log(result.html.slice(0, 800));

console.log("\n=== warnings ===");
for (const w of result.warnings) console.log("  ⚠ " + w);

// Write the full HTML for visual inspection in a browser.
const fullPath = join(root, "tests", "demo.rendered.html");
const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<link rel="stylesheet" href="../src/media/style.css"/>
<script src="../src/media/highlight.min.js"></script>
</head><body class="vscode-light">
<div id="app"><main class="cf-main">
  <article class="cf-content">${result.html}</article>
</main></div>
<script>if(window.hljs){hljs.highlightAll();}</script>
</body></html>`;
writeFileSync(fullPath, html, "utf8");
console.log("\nFull render written to " + fullPath);