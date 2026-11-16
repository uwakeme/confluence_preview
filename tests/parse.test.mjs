import test from "node:test";
import assert from "node:assert/strict";
import { parseConfluence } from "./parser.bundle.mjs";

test("empty document yields an empty result", () => {
  const r = parseConfluence("");
  assert.equal(r.html, "");
  assert.deepEqual(r.outline, []);
  assert.deepEqual(r.macros, []);
  assert.deepEqual(r.warnings, []);
});

test("whitespace-only document yields no visible content", () => {
  const r = parseConfluence("\n\t  \n");
  assert.equal(r.html.trim(), "");
  assert.deepEqual(r.outline, []);
});

test("macro names are collected lowercased, including nested ones", () => {
  const r = parseConfluence(
    `<ac:structured-macro ac:name="PANEL"><ac:rich-text-body>` +
    `<ac:structured-macro ac:name="Code"><ac:plain-text-body><![CDATA[x]]></ac:plain-text-body></ac:structured-macro>` +
    `</ac:rich-text-body></ac:structured-macro>`,
  );
  assert.deepEqual(r.macros, ["panel", "code"]);
});

test("warnings are deduplicated", () => {
  const r = parseConfluence(
    `<ac:structured-macro ac:name="galaxy"/><ac:structured-macro ac:name="galaxy"/>`,
  );
  assert.deepEqual(r.warnings, ["Unsupported macro: galaxy"]);
});

test("malformed input does not throw", () => {
  for (const src of ["<<<>>>", "<p>unclosed", "<ac:structured-macro>", "&amp;&lt;"]) {
    assert.doesNotThrow(() => parseConfluence(src));
  }
});

test("options are optional and default to offline behaviour", () => {
  const r = parseConfluence(`<ac:link><ri:page ri:content-title="T" ri:space-key="S"/></ac:link>`);
  assert.match(r.html, /href="#"/);
});

test("the full example document parses without warnings", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("./test.confluence", import.meta.url), "utf8");
  const r = parseConfluence(src);
  assert.ok(r.html.length > 0);
  assert.ok(r.outline.length > 0);
  assert.deepEqual(r.warnings, []);
});