import test from "node:test";
import assert from "node:assert/strict";
import { parseConfluence } from "./parser.bundle.mjs";

test("outline nests by heading level", () => {
  const r = parseConfluence(`<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2><h1>E</h1>`);
  assert.equal(r.outline.length, 2);
  assert.equal(r.outline[0].text, "A");
  assert.equal(r.outline[0].children.length, 2);
  assert.equal(r.outline[0].children[0].text, "B");
  assert.equal(r.outline[0].children[0].children[0].text, "C");
  assert.equal(r.outline[0].children[1].text, "D");
  assert.equal(r.outline[1].text, "E");
});

test("duplicate headings get unique, stable ids", () => {
  const r = parseConfluence(`<h2>Setup</h2><p>x</p><h2>Setup</h2>`);
  assert.deepEqual(r.outline.map((n) => n.id), ["h-setup-1", "h-setup-2"]);
  assert.ok(r.html.includes('id="h-setup-1"'));
  assert.ok(r.html.includes('id="h-setup-2"'));
});

test("ids are stable when unrelated content changes", () => {
  const a = parseConfluence(`<h1>Intro</h1><p>one</p><h2>Details</h2>`);
  const b = parseConfluence(`<h1>Intro</h1><p>totally different text</p><h2>Details</h2>`);
  assert.deepEqual(a.outline.map((n) => n.id), b.outline.map((n) => n.id));
});

test("CJK heading text is kept in the slug", () => {
  const r = parseConfluence(`<h1>安装指南</h1>`);
  assert.equal(r.outline[0].id, "h-安装指南-1");
});

test("empty heading text falls back to 'section'", () => {
  const r = parseConfluence(`<h1>   </h1>`);
  assert.equal(r.outline[0].id, "h-section-1");
});

test("sourceOffset points at the real heading tag", () => {
  const src = `<p>intro</p>\n<h1>Real</h1>\n<h2>Sub</h2>`;
  const r = parseConfluence(src);
  assert.equal(r.outline[0].sourceOffset, src.indexOf("<h1>"));
  assert.equal(r.outline[0].children[0].sourceOffset, src.indexOf("<h2>"));
});

test("CDATA decoy headings are not collected and do not shift offsets", () => {
  const src =
    `<ac:structured-macro ac:name="code"><ac:plain-text-body>` +
    `<![CDATA[<h1>Fake</h1>]]>` +
    `</ac:plain-text-body></ac:structured-macro>\n<h1>Real</h1>`;
  const r = parseConfluence(src);
  assert.equal(r.outline.length, 1);
  assert.equal(r.outline[0].text, "Real");
  assert.equal(r.outline[0].sourceOffset, src.indexOf("<h1>Real"));
});

test("comment and parameter decoy headings are ignored", () => {
  const src =
    `<!-- <h1>Comment</h1> -->` +
    `<ac:structured-macro ac:name="panel"><ac:parameter ac:name="title"><h1>Param</h1></ac:parameter>` +
    `<ac:rich-text-body><p>b</p></ac:rich-text-body></ac:structured-macro>` +
    `<h1>Real</h1>`;
  const r = parseConfluence(src);
  assert.equal(r.outline.length, 1);
  assert.equal(r.outline[0].text, "Real");
  assert.equal(r.outline[0].sourceOffset, src.indexOf("<h1>Real"));
});

test("heading with attributes still gets an offset", () => {
  const src = `<h2 style="text-align: center">Styled</h2>`;
  const r = parseConfluence(src);
  assert.equal(r.outline[0].sourceOffset, 0);
});

test("outline text strips inline markup", () => {
  const r = parseConfluence(`<h1>Hello <em>world</em> &amp; more</h1>`);
  assert.equal(r.outline[0].text, "Hello world & more");
});