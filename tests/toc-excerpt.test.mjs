import test from "node:test";
import assert from "node:assert/strict";
import { parseConfluence } from "./parser.bundle.mjs";

const html = (src) => parseConfluence(src).html;
const macro = (name, params = "", body = "") =>
  `<ac:structured-macro ac:name="${name}">${params}${body}</ac:structured-macro>`;
const param = (name, value) => `<ac:parameter ac:name="${name}">${value}</ac:parameter>`;
const rich = (inner) => `<ac:rich-text-body>${inner}</ac:rich-text-body>`;

// ---------- inline TOC ----------

test("toc macro renders in place from the finalized outline", () => {
  const out = html(macro("toc") + `<h1>One</h1><h2>Two</h2>`);
  assert.match(out, /<div class="cf-toc" data-toc-idx="0"><ul class="cf-toc-list">/);
  assert.ok(out.includes('href="#h-one-1"'));
  assert.ok(out.includes('href="#h-two-1"'));
  assert.ok(!out.includes('data-toc-idx="0"></div>'));
});

test("toc aliases table-of-contents / table-of-content", () => {
  for (const name of ["table-of-contents", "table-of-content"]) {
    const out = html(macro(name) + `<h1>X</h1>`);
    assert.ok(out.includes('href="#h-x-1"'), name);
  }
});

test("toc maxLevel filters deeper headings out", () => {
  const out = html(macro("toc", param("maxLevel", "1")) + `<h1>One</h1><h2>Two</h2>`);
  assert.ok(out.includes('href="#h-one-1"'));
  assert.ok(!out.includes('href="#h-two-1"'));
});

test("toc minLevel promotes in-range descendants", () => {
  const out = html(macro("toc", param("minLevel", "2")) + `<h1>One</h1><h2>Two</h2>`);
  assert.ok(!out.includes('href="#h-one-1"'));
  assert.ok(out.includes('href="#h-two-1"'));
  assert.match(out, /<li class="cf-toc-promoted">/);
});

test("toc type=flat renders a single-level list", () => {
  const out = html(macro("toc", param("type", "flat")) + `<h1>One</h1><h2>Two</h2>`);
  assert.match(out, /<ul class="cf-toc-list"><li><a[^>]*>One<\/a><\/li><li><a[^>]*>Two<\/a><\/li><\/ul>/);
});

test("toc with no headings in range shows an empty notice", () => {
  const out = html(macro("toc", param("minLevel", "3")) + `<h1>One</h1>`);
  assert.ok(out.includes("No headings in range"));
});

test("multiple tocs resolve independently", () => {
  const out = html(
    macro("toc", param("maxLevel", "1")) + `<h1>A</h1>` +
    macro("toc", param("maxLevel", "2")) + `<h2>B</h2>`,
  );
  assert.match(out, /data-toc-idx="0"><ul class="cf-toc-list"><li><a[^>]*>A<\/a><\/li><\/ul><\/div>/);
  assert.ok(out.includes('data-toc-idx="1"'));
  assert.ok(out.includes('href="#h-b-1"'));
});

// ---------- excerpt-include ----------

test("same-page excerpt-include resolves even when defined later", () => {
  const r = parseConfluence(
    macro("excerpt-include", param("name", "shared")) +
    macro("excerpt", param("name", "shared"), rich("<p>Shared body</p>")),
  );
  assert.match(r.html, /<aside class="cf-excerpt cf-excerpt-included">/);
  assert.ok(r.html.includes("Excerpt: shared"));
  assert.equal(r.html.match(/Shared body/g).length, 2);
  assert.deepEqual(r.warnings, []);
});

test("unnamed excerpt and include pair via 'default'", () => {
  const r = parseConfluence(
    macro("excerpt", "", rich("<p>def</p>")) + macro("excerpt-include"),
  );
  assert.match(r.html, /cf-excerpt-included/);
  assert.deepEqual(r.warnings, []);
});

test("cross-page excerpt-include stays a placeholder with a warning", () => {
  const r = parseConfluence(
    macro("excerpt-include", param("name", "x") + `<ri:page ri:content-title="Other Page"/>`),
  );
  assert.match(r.html, /cf-excerpt-include/);
  assert.ok(r.html.includes("not resolvable offline"));
  assert.deepEqual(r.warnings, ["Unresolved excerpt-include: x"]);
});

test("missing same-page excerpt warns and degrades", () => {
  const r = parseConfluence(macro("excerpt-include", param("name", "ghost")));
  assert.ok(r.html.includes("not resolvable offline"));
  assert.deepEqual(r.warnings, ["Unresolved excerpt-include: ghost"]);
});