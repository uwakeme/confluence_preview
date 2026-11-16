import test from "node:test";
import assert from "node:assert/strict";
import { parseConfluence } from "./parser.bundle.mjs";

const html = (src, opts) => parseConfluence(src, opts).html;
const macro = (name, params = "", body = "") =>
  `<ac:structured-macro ac:name="${name}">${params}${body}</ac:structured-macro>`;
const param = (name, value) => `<ac:parameter ac:name="${name}">${value}</ac:parameter>`;
const rich = (inner) => `<ac:rich-text-body>${inner}</ac:rich-text-body>`;
const cdata = (text) => `<ac:plain-text-body><![CDATA[${text}]]></ac:plain-text-body>`;

// ---------- code ----------

test("code macro: title, language alias, line number attrs, CDATA fidelity", () => {
  const out = html(macro("code",
    param("title", "demo.js") + param("language", "js") +
    param("linenumbers", "true") + param("firstline", "10"),
    cdata("const a = 1;\nconst b = 2;")));
  assert.match(out, /<div class="cf-code-title">demo\.js<\/div>/);
  assert.match(out, /class="language-javascript hljs"/);
  assert.match(out, /data-linenumbers="1"/);
  assert.match(out, /data-firstline="10"/);
  assert.ok(out.includes("const a = 1;\nconst b = 2;"));
});

test("code macro: collapse renders a details block", () => {
  const out = html(macro("code",
    param("collapse", "true") + param("title", "snippet") + param("language", "sql"),
    cdata("SELECT 1;")));
  assert.match(out, /<details class="cf-code cf-code-collapsible">/);
  assert.match(out, /<summary class="cf-code-summary">snippet <span class="cf-code-lang">sql<\/span><\/summary>/);
});

test("code macro: defaults to plaintext, firstline 1, no line numbers", () => {
  const out = html(macro("code", "", cdata("hello")));
  assert.match(out, /class="language-plaintext hljs"/);
  assert.match(out, /data-linenumbers="0"/);
  assert.match(out, /data-firstline="1"/);
  assert.ok(!out.includes("cf-code-title"));
});

test("code macro: invalid firstline falls back to 1", () => {
  const out = html(macro("code", param("firstline", "-5"), cdata("x")));
  assert.match(out, /data-firstline="1"/);
});

// ---------- callouts ----------

test("note/info/warning/tip render with default titles", () => {
  for (const [name, title] of [["note", "Note"], ["info", "Info"], ["warning", "Warning"], ["tip", "Tip"]]) {
    const out = html(macro(name, "", rich("<p>body</p>")));
    assert.ok(out.includes(`cf-callout-${name}`), name);
    assert.ok(out.includes(`<span>${title}</span>`), name);
    assert.ok(out.includes("<p class=\"cf-paragraph\">body</p>"), name);
  }
});

test("panel: validated style params become CSS custom properties", () => {
  const out = html(macro("panel",
    param("borderColor", "#ff0000") + param("borderStyle", "dashed") +
    param("borderWidth", "2px") + param("titleBGColor", "#eeeeee") +
    param("titleColor", "#333333") + param("title", "Custom"),
    rich("<p>b</p>")));
  assert.match(out, /--cf-panel-border: #ff0000/);
  assert.match(out, /--cf-panel-border-style: dashed/);
  assert.match(out, /--cf-panel-border-width: 2px/);
  assert.match(out, /--cf-panel-title-bg: #eeeeee/);
  assert.match(out, /--cf-panel-title-color: #333333/);
  assert.ok(out.includes("<span>Custom</span>"));
});

test("panel without title has no title bar", () => {
  const out = html(macro("panel", "", rich("<p>b</p>")));
  assert.ok(!out.includes("cf-callout-title"));
});

test("empty self-closing title param suppresses the title bar", () => {
  const out = html(macro("panel", `<ac:parameter ac:name="title"/>`, rich("<p>b</p>")));
  assert.ok(!out.includes("cf-callout-title"));
});

// ---------- expand / quote / noformat ----------

test("expand renders details with title", () => {
  const out = html(macro("expand", param("title", "More"), rich("<p>hidden</p>")));
  assert.match(out, /<details class="cf-expand"><summary class="cf-expand-title">More<\/summary>/);
  assert.ok(out.includes('<div class="cf-expand-body"><p class="cf-paragraph">hidden</p></div>'));
});

test("quote macro renders a styled blockquote", () => {
  const out = html(macro("quote", "", rich("<p>words</p>")));
  assert.match(out, /<blockquote class="cf-quote cf-quote-macro">/);
});

test("noformat preserves CDATA verbatim (escaped)", () => {
  const out = html(macro("noformat", "", cdata("  a < b\n  c")));
  assert.match(out, /<pre class="cf-noformat">  a &lt; b\n  c<\/pre>/);
});

// ---------- status ----------

test("status: colour map, title param, subtle variant", () => {
  const out = html(macro("status", param("colour", "green") + param("title", "DONE")));
  assert.match(out, /<span class="cf-status-pill" style="background:#14892c;color:#fff">DONE<\/span>/);
  const subtle = html(macro("status", param("color", "red") + param("subtle", "true") + param("title", "BLOCKED")));
  assert.match(subtle, /border:1px solid #d04437;color:#d04437/);
});

test("status: falls back to rich body text, then 'Status'", () => {
  const out = html(macro("status", "", rich("<p>IN REVIEW</p>")));
  assert.ok(out.includes(">IN REVIEW</span>"));
  const empty = html(macro("status"));
  assert.ok(empty.includes(">Status</span>"));
});

// ---------- excerpt ----------

test("excerpt registers its body; hidden variant is marked", () => {
  const out = html(macro("excerpt", param("name", "shared"), rich("<p>reuse me</p>")));
  assert.match(out, /<aside class="cf-excerpt">/);
  assert.ok(out.includes("reuse me"));
  const hidden = html(macro("excerpt", param("hidden", "true"), rich("<p>x</p>")));
  assert.match(hidden, /cf-excerpt-hidden/);
});

// ---------- children / anchor ----------

test("children macro renders an offline placeholder with depth", () => {
  const out = html(macro("children", param("depth", "2")));
  assert.match(out, /cf-children-placeholder/);
  assert.ok(out.includes("depth=2"));
});

test("anchor accepts anchor-name, anchor, and unnamed params", () => {
  for (const p of [param("anchor-name", "a1"), param("anchor", "a1"), param("", "a1")]) {
    const out = html(macro("anchor", p));
    assert.match(out, /<span id="a1" class="cf-anchor"><\/span>/);
  }
  assert.equal(html(macro("anchor")), "");
});

// ---------- jira ----------

test("jira: baseurl param builds a real link", () => {
  const out = html(macro("jira", param("key", "PROJ-123") + param("baseurl", "https://jira.example.com")));
  assert.match(out, /<a class="cf-link cf-jira-link" href="https:\/\/jira\.example\.com\/browse\/PROJ-123"/);
  assert.ok(out.includes("🎫 PROJ-123"));
});

test("jira: falls back to the jiraBaseUrl option", () => {
  const out = html(macro("jira", param("key", "ABC-9")), { jiraBaseUrl: "https://j.example.com/" });
  assert.match(out, /href="https:\/\/j\.example\.com\/browse\/ABC-9"/);
});

test("jira: unresolvable issue renders a badge, not a link", () => {
  const out = html(macro("jira", param("key", "ABC-9")));
  assert.match(out, /<span class="cf-jira-link cf-jira-badge"/);
  assert.ok(!out.includes("<a "));
});

// ---------- user-mention ----------

test("user-mention: parameter aliases and display name", () => {
  const out = html(macro("user-mention", param("account-id", "zhangsan") + param("display-name", "张三")));
  assert.match(out, /<span class="cf-user-mention" title="zhangsan">@张三<\/span>/);
  const legacy = html(macro("user-mention", param("userKey", "k123")));
  assert.match(legacy, /title="k123">@k123</);
});

// ---------- section / column ----------

test("section/column: flex layout with validated width", () => {
  const out = html(macro("section", "", rich(
    macro("column", param("width", "40%"), rich("<p>left</p>")) +
    macro("column", "", rich("<p>right</p>")))));
  assert.match(out, /<div class="cf-section">/);
  assert.match(out, /<div class="cf-column" style="flex: 1 1 40%">/);
  assert.match(out, /<div class="cf-column">/);
});

// ---------- emoticon ----------

test("emoticon: inline self-closing tag does not swallow following text", () => {
  const out = html(`<p>hi <ac:emoticon ac:name="smile"/> there</p>`);
  assert.ok(out.includes("😊"));
  assert.ok(out.includes(" there"));
});

test("emoticon: structured macro, cheese alias, unknown fallback", () => {
  assert.ok(html(macro("emoticon", param("name", "thumbs_up"))).includes("👍"));
  assert.ok(html(`<ac:emoticon ac:name="cheese"/>`).includes("🧀"));
  assert.ok(html(`<ac:emoticon ac:name="nonexistent"/>`).includes("🙂"));
});

// ---------- link / pagelink ----------

test("link macro: rich body text wins over params", () => {
  const out = html(macro("link", param("url", "https://example.com"), rich("<strong>click</strong>")));
  assert.match(out, /<a class="cf-link cf-macro-link" href="https:\/\/example\.com"[^>]*><strong>click<\/strong><\/a>/);
});

test("pagelink alias and CDATA body", () => {
  const out = html(macro("pagelink", param("url", "https://example.com"), cdata("text body")));
  assert.ok(out.includes(">text body</a>"));
});

// ---------- fallback / nested ----------

test("unknown macro: fallback box plus warning", () => {
  const r = parseConfluence(macro("galaxy", "", rich("<p>stuff</p>")));
  assert.match(r.html, /cf-macro-fallback/);
  assert.ok(r.html.includes("⌘ galaxy macro"));
  assert.ok(r.html.includes("stuff"));
  assert.deepEqual(r.warnings, ["Unsupported macro: galaxy"]);
});

test("nested macros keep their own parameters", () => {
  const r = parseConfluence(macro("panel", param("title", "OuterTitle"), rich(
    macro("code", param("title", "InnerCode"), cdata("x")))));
  assert.ok(r.html.includes("OuterTitle"));
  assert.ok(r.html.includes("InnerCode"));
  assert.deepEqual(r.macros, ["panel", "code"]);
});

test("CDATA-wrapped parameters are decoded", () => {
  const out = html(macro("panel",
    `<ac:parameter ac:name="title"><![CDATA[Title <with> tags]]></ac:parameter>`,
    rich("<p>b</p>")));
  assert.ok(out.includes("Title &lt;with&gt; tags"));
});