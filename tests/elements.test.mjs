import test from "node:test";
import assert from "node:assert/strict";
import { parseConfluence } from "./parser.bundle.mjs";

const html = (src, opts) => parseConfluence(src, opts).html;

// ---------- headings / text ----------

test("headings get ids and the cf-heading class", () => {
  const out = html(`<h1>Title</h1><h3>Sub</h3>`);
  assert.match(out, /<h1 id="h-title-1" class="cf-heading">Title<\/h1>/);
  assert.match(out, /<h3 id="h-sub-1" class="cf-heading">Sub<\/h3>/);
});

test("inline formatting elements render", () => {
  const out = html(
    `<p><strong>b</strong><em>i</em><u>u</u><s>s</s><sub>sub</sub><sup>sup</sup>` +
    `<code>inline</code><mark>m</mark><kbd>K</kbd><br/><small>sm</small></p>`,
  );
  for (const frag of ["<strong>b</strong>", "<em>i</em>", "<u>u</u>", "<s>s</s>",
    "<sub>sub</sub>", "<sup>sup</sup>", '<code class="cf-inline-code">inline</code>',
    '<mark class="cf-mark">m</mark>', '<kbd class="cf-kbd">K</kbd>', "<br/>",
    '<small class="cf-small">sm</small>']) {
    assert.ok(out.includes(frag), frag);
  }
});

test("span keeps class and safe inline styles", () => {
  const out = html(`<span class="highlight" style="color: red; text-align: center">x</span>`);
  assert.match(out, /<span class="cf-span highlight" style="color: red">x<\/span>/);
});

test("p and div keep text-align", () => {
  const out = html(`<p style="text-align: right">a</p><div style="text-align: center">b</div>`);
  assert.match(out, /<p class="cf-paragraph" style="text-align: right">/);
  assert.match(out, /<div class="cf-div" style="text-align: center">/);
});

// ---------- lists ----------

test("ordered list start attribute is preserved when numeric", () => {
  const out = html(`<ol start="3"><li>third</li><li>fourth</li></ol>`);
  assert.match(out, /<ol class="cf-list" start="3">/);
  const bad = html(`<ol start="x"><li>a</li></ol>`);
  assert.match(bad, /<ol class="cf-list">/);
});

test("nested lists render recursively", () => {
  const out = html(`<ul><li>a<ul><li>b</li></ul></li></ul>`);
  assert.match(out, /<ul class="cf-list"><li class="cf-list-item">a<ul class="cf-list"><li class="cf-list-item">b<\/li><\/ul><\/li><\/ul>/);
});

// ---------- tables ----------

test("table: wrapper, colspan/rowspan, th scope", () => {
  const out = html(
    `<table><tbody><tr><th scope="col" colspan="2">H</th></tr>` +
    `<tr><td rowspan="2">a</td><td>b</td></tr></tbody></table>`,
  );
  assert.match(out, /<div class="cf-table-wrapper"><table class="cf-table">/);
  assert.match(out, /<th colspan="2" scope="col">H<\/th>/);
  assert.match(out, /<td rowspan="2">a<\/td>/);
});

test("table: colgroup/col widths and tfoot", () => {
  const out = html(
    `<table><colgroup><col span="2" width="120px"/><col width="bogus"/></colgroup>` +
    `<tbody><tr><td>x</td></tr></tbody><tfoot><tr><td>f</td></tr></tfoot></table>`,
  );
  assert.match(out, /<col span="2" style="width: 120px"\/>/);
  assert.match(out, /<col\/>/);
  assert.match(out, /<tfoot><tr><td>f<\/td><\/tr><\/tfoot>/);
});

test("table: non-numeric colspan is dropped", () => {
  const out = html(`<table><tr><td colspan="2; drop">x</td></tr></table>`);
  assert.ok(!out.includes("colspan"));
});

test("table: highlight colour picks a readable text color", () => {
  const light = html(`<table><tr><td data-highlight-colour="#e3fcef">x</td></tr></table>`);
  assert.match(light, /background-color: #e3fcef; color: #1f2328/);
  const dark = html(`<table><tr><td data-highlight-colour="#172b4d">x</td></tr></table>`);
  assert.match(dark, /background-color: #172b4d; color: #f0f0f0/);
  const rgb = html(`<table><tr><td data-highlight-colour="rgb(0, 0, 0)">x</td></tr></table>`);
  assert.match(rgb, /color: #f0f0f0/);
});

// ---------- links ----------

test("plain anchors are sanitized and open externally", () => {
  const out = html(`<a href="https://example.com">x</a>`);
  assert.match(out, /<a class="cf-link" href="https:\/\/example\.com" target="_blank" rel="noopener">x<\/a>/);
});

test("ac:link ri:page without baseUrl renders a labelled placeholder", () => {
  const out = html(`<ac:link><ri:page ri:content-title="Setup Guide"/></ac:link>`);
  assert.match(out, /<a class="cf-link cf-page-link" href="#"/);
  assert.ok(out.includes(">Setup Guide</a>"));
  assert.ok(out.includes("confluence-previewer.baseUrl"));
});

test("ac:link ri:page with baseUrl + space key resolves to a real URL", () => {
  const out = html(
    `<ac:link ac:anchor="intro"><ri:page ri:content-title="Setup Guide" ri:space-key="DEV"/></ac:link>`,
    { baseUrl: "https://confluence.example.com" },
  );
  assert.match(out, /href="https:\/\/confluence\.example\.com\/display\/DEV\/Setup%20Guide#intro"/);
});

test("ac:link custom plain-text and rich link bodies", () => {
  const plain = html(
    `<ac:link><ri:page ri:content-title="Target"/><ac:plain-text-link-body><![CDATA[custom text]]></ac:plain-text-link-body></ac:link>`,
  );
  assert.ok(plain.includes(">custom text</a>"));
  const richBody = html(
    `<ac:link><ri:page ri:content-title="Target"/><ac:link-body><strong>bold</strong></ac:link-body></ac:link>`,
  );
  assert.ok(richBody.includes("<strong>bold</strong></a>"));
});

test("ac:link ri:attachment resolves locally via host callback", () => {
  const out = html(
    `<ac:link><ri:attachment ri:filename="report.pdf"/></ac:link>`,
    { resolveLocalFile: (f) => (f === "report.pdf" ? "webview://report.pdf" : undefined) },
  );
  assert.match(out, /data-attachment="report\.pdf"/);
  assert.ok(out.includes("📎 report.pdf"));
  const missing = html(`<ac:link><ri:attachment ri:filename="gone.pdf"/></ac:link>`);
  assert.ok(missing.includes("not resolvable offline"));
  assert.ok(!missing.includes("data-attachment"));
});

test("ac:link ri:user renders a mention with identifier aliases", () => {
  for (const attr of [`ri:username="u1"`, `ri:account-id="u1"`, `ri:userkey="u1"`]) {
    const out = html(`<ac:link><ri:user ${attr}/></ac:link>`);
    assert.match(out, /<span class="cf-user-mention" title="u1">@user<\/span>/);
  }
});

test("ac:link anchor-only links stay in-page", () => {
  const out = html(`<ac:link ac:anchor="section-2"><ac:plain-text-link-body><![CDATA[go]]></ac:plain-text-link-body></ac:link>`);
  assert.match(out, /<a class="cf-link cf-anchor-link" href="#section-2">go<\/a>/);
});

// ---------- images ----------

test("ac:image: local attachment renders an img with dimensions", () => {
  const out = html(
    `<ac:image ac:alt="diagram" ac:width="300" ac:height="200" ac:border="true">` +
    `<ri:attachment ri:filename="pic.png"/></ac:image>`,
    { resolveLocalFile: () => "webview://pic.png" },
  );
  assert.match(out, /<img class="cf-image cf-image-bordered" src="webview:\/\/pic\.png" alt="diagram" width="300" height="200"\/>/);
});

test("ac:image: missing attachment renders a placeholder with dims", () => {
  const out = html(
    `<ac:image ac:width="640"><ri:attachment ri:filename="missing.png"/></ac:image>`,
  );
  assert.match(out, /cf-image-placeholder/);
  assert.ok(out.includes("missing.png"));
  assert.match(out, /<span class="cf-image-dims">640×\?<\/span>/);
  assert.ok(!out.includes("<img"));
});

test("ac:image: external ri:url is never loaded", () => {
  const out = html(`<ac:image><ri:url ri:value="https://evil/x.png"/></ac:image>`);
  assert.ok(!out.includes("<img"));
  assert.ok(!out.includes('src="https://evil'));
  assert.match(out, /cf-image-placeholder/);
});

test("ac:image: caption becomes figure/figcaption", () => {
  const out = html(
    `<ac:image><ri:attachment ri:filename="p.png"/><ac:caption>A <strong>caption</strong></ac:caption></ac:image>`,
  );
  assert.match(out, /<figure class="cf-figure">/);
  assert.match(out, /<figcaption class="cf-figcaption">A <strong>caption<\/strong><\/figcaption>/);
});

test("ac:image: non-numeric dimensions are dropped", () => {
  const out = html(
    `<ac:image ac:width="300px" ac:height="auto"><ri:attachment ri:filename="p.png"/></ac:image>`,
    { resolveLocalFile: () => "webview://p.png" },
  );
  assert.ok(!out.includes("width="));
  assert.ok(!out.includes("height="));
});

test("relative img src resolves locally, external stays a placeholder", () => {
  const out = html(
    `<img src="images/a.png" alt="a"/><img src="https://evil/b.png" alt="b"/>`,
    { resolveLocalFile: (f) => (f === "images/a.png" ? "webview://a.png" : undefined) },
  );
  assert.match(out, /<img class="cf-image" src="webview:\/\/a\.png" alt="a"\/>/);
  assert.ok(!out.includes("https://evil"));
});

// ---------- task lists ----------

test("ac:task-list renders disabled checkboxes with completion state", () => {
  const out = html(
    `<ac:task-list>` +
    `<ac:task><ac:task-id>1</ac:task-id><ac:task-status>complete</ac:task-status><ac:task-body>done</ac:task-body></ac:task>` +
    `<ac:task><ac:task-id>2</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body>todo</ac:task-body></ac:task>` +
    `</ac:task-list>`,
  );
  assert.match(out, /<ul class="cf-task-list">/);
  assert.match(out, /<input type="checkbox" class="cf-task-checkbox" disabled checked\/><span class="cf-task-body">done<\/span>/);
  assert.match(out, /<input type="checkbox" class="cf-task-checkbox" disabled\/><span class="cf-task-body">todo<\/span>/);
});

// ---------- modern layouts ----------

test("ac:layout renders sections with validated type", () => {
  const out = html(
    `<ac:layout><ac:layout-section ac:type="two_equal">` +
    `<ac:layout-cell><p>left</p></ac:layout-cell><ac:layout-cell><p>right</p></ac:layout-cell>` +
    `</ac:layout-section></ac:layout>`,
  );
  assert.match(out, /<div class="cf-layout"><div class="cf-layout-section" data-type="two_equal">/);
  assert.equal(out.match(/cf-layout-cell/g).length, 2);
});

test("ac:layout unknown type falls back to single", () => {
  const out = html(`<ac:layout><ac:layout-section ac:type="evil"><ac:layout-cell><p>x</p></ac:layout-cell></ac:layout-section></ac:layout>`);
  assert.match(out, /data-type="single"/);
});

// ---------- misc ----------

test("bare pre and blockquote render escaped", () => {
  const out = html(`<pre>a < b</pre><blockquote><p>q</p></blockquote>`);
  assert.match(out, /<pre class="cf-pre">a &lt; b<\/pre>/);
  assert.match(out, /<blockquote class="cf-quote"><p class="cf-paragraph">q<\/p><\/blockquote>/);
});

test("unknown standard elements degrade to their children", () => {
  const out = html(`<custom-thing><p>kept</p></custom-thing>`);
  assert.ok(out.includes('<p class="cf-paragraph">kept</p>'));
  assert.ok(!out.includes("custom-thing"));
});

test("comments are dropped", () => {
  const out = html(`<p>a</p><!-- secret --><p>b</p>`);
  assert.ok(!out.includes("secret"));
});