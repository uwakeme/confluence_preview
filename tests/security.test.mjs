import test from "node:test";
import assert from "node:assert/strict";
import { parseConfluence } from "./parser.bundle.mjs";

const html = (src, opts) => parseConfluence(src, opts).html;

test("script tags never survive rendering", () => {
  const out = html(`<p>before</p><script>alert(1)</script><p>after</p>`);
  assert.ok(!out.includes("<script"));
  assert.ok(out.includes("before"));
  assert.ok(out.includes("after"));
});

test("event handler attributes are dropped", () => {
  const out = html(`<p onclick="alert(1)" onmouseover="evil()">text</p>`);
  assert.ok(!out.includes("onclick"));
  assert.ok(!out.includes("onmouseover"));
  assert.ok(out.includes("text"));
});

test("javascript: hrefs are neutralized everywhere", () => {
  const out = html(
    `<a href="javascript:alert(1)">x</a>` +
    `<ac:link><ri:url ri:value="javascript:alert(2)"/></ac:link>` +
    `<ac:structured-macro ac:name="link"><ac:parameter ac:name="url">javascript:alert(3)</ac:parameter></ac:structured-macro>`,
  );
  assert.ok(!out.includes('href="javascript:'));
  assert.equal(out.match(/href="#"/g).length, 3);
});

test("data: and vbscript: hrefs are neutralized", () => {
  const out = html(`<a href="data:text/html,<script>1</script>">x</a><a href="vbscript:msgbox(1)">y</a>`);
  assert.ok(!out.includes("data:text/html"));
  assert.ok(!out.includes("vbscript:"));
});

test("style allowlist strips dangerous declarations", () => {
  const out = html(
    `<p style="color: red; background-image: url(https://evil/x.png); position: fixed">t</p>`,
  );
  assert.match(out, /style="color: red"/);
  assert.ok(!out.includes("url("));
  assert.ok(!out.includes("position"));
});

test("expression() and CSS escapes are rejected", () => {
  const out = html(
    `<span style="color: expression(alert(1))">a</span><span style="color: r\\65 d">b</span>`,
  );
  assert.ok(!out.includes("expression"));
  assert.ok(!out.includes("style="));
});

test("non-allowlisted style properties are dropped on cells", () => {
  const out = html(
    `<table><tr><td style="position: absolute; text-align: center">x</td></tr></table>`,
  );
  assert.match(out, /style="text-align: center"/);
  assert.ok(!out.includes("position"));
});

test("panel color params cannot inject declarations", () => {
  const out = html(
    `<ac:structured-macro ac:name="panel">` +
    `<ac:parameter ac:name="borderColor">red; position: fixed</ac:parameter>` +
    `<ac:parameter ac:name="title">T</ac:parameter>` +
    `<ac:rich-text-body><p>b</p></ac:rich-text-body></ac:structured-macro>`,
  );
  assert.ok(!out.includes("position"));
  assert.ok(!out.includes("style="));
});

test("column width params cannot inject declarations", () => {
  const out = html(
    `<ac:structured-macro ac:name="column">` +
    `<ac:parameter ac:name="width">40%; background: url(x)</ac:parameter>` +
    `<ac:rich-text-body><p>c</p></ac:rich-text-body></ac:structured-macro>`,
  );
  assert.match(out, /<div class="cf-column">/);
  assert.ok(!out.includes("url("));
});

test("table highlight colour must be a real color", () => {
  const out = html(
    `<table><tr><td data-highlight-colour="url(https://evil)">x</td></tr></table>`,
  );
  assert.ok(!out.includes("background-color"));
  const ok = html(
    `<table><tr><td data-highlight-colour="#ffff00">x</td></tr></table>`,
  );
  assert.match(ok, /background-color: #ffff00/);
});

test("external images are placeholders, data: images pass through", () => {
  const out = html(
    `<img src="https://evil/x.png" alt="x"/><img src="data:image/png;base64,AAAA" alt="y"/>`,
  );
  assert.ok(!out.includes("https://evil"));
  assert.match(out, /cf-image-placeholder/);
  assert.match(out, /src="data:image\/png;base64,AAAA"/);
});

test("macro params are attribute-escaped", () => {
  const out = html(
    `<ac:structured-macro ac:name="panel">` +
    `<ac:parameter ac:name="title"><![CDATA["><img src=x onerror=alert(1)>]]></ac:parameter>` +
    `<ac:rich-text-body><p>b</p></ac:rich-text-body></ac:structured-macro>`,
  );
  assert.ok(!out.includes("<img"));
  assert.ok(out.includes("&quot;&gt;"));
});

test("code macro CDATA is escaped, not interpreted", () => {
  const out = html(
    `<ac:structured-macro ac:name="code"><ac:plain-text-body>` +
    `<![CDATA[</script><script>alert(1)</script>]]>` +
    `</ac:plain-text-body></ac:structured-macro>`,
  );
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;/script&gt;"));
});

test("heading entities are decoded for the outline and re-escaped for HTML", () => {
  const r = parseConfluence(`<h1>A &amp; B &lt;tag&gt;</h1>`);
  assert.equal(r.outline[0].text, "A & B <tag>");
  assert.ok(r.html.includes("A &amp; B &lt;tag&gt;"));
});

test("ac:image alt/title cannot break out of attributes", () => {
  const out = html(
    `<ac:image ac:alt="&quot;&gt;&lt;script&gt;" ac:title="t&quot; onmouseover=&quot;evil()">` +
    `<ri:attachment ri:filename="x.png"/></ac:image>`,
  );
  assert.ok(!out.includes("<script"));
  assert.ok(!out.includes('onmouseover="'));
});

test("local file resolution is delegated to the host callback", () => {
  const seen = [];
  const out = html(
    `<ac:image ac:width="300"><ri:attachment ri:filename="../secret.png"/></ac:image>`,
    { resolveLocalFile: (f) => { seen.push(f); return undefined; } },
  );
  assert.deepEqual(seen, ["../secret.png"]);
  assert.match(out, /cf-image-placeholder/);
  assert.ok(!out.includes("<img"));
});