import test from "node:test";
import assert from "node:assert/strict";
import { confluenceToMarkdown } from "./parser.bundle.mjs";

const md = (src, opts) => confluenceToMarkdown(src, opts);
const macro = (name, params = "", body = "") =>
  `<ac:structured-macro ac:name="${name}">${params}${body}</ac:structured-macro>`;
const param = (name, value) => `<ac:parameter ac:name="${name}">${value}</ac:parameter>`;
const rich = (inner) => `<ac:rich-text-body>${inner}</ac:rich-text-body>`;
const cdata = (text) => `<ac:plain-text-body><![CDATA[${text}]]></ac:plain-text-body>`;

test("headings become ATX headings", () => {
  const out = md(`<h1>Title</h1><h2>Sub</h2><h3>Deep</h3>`);
  assert.ok(out.includes("# Title"));
  assert.ok(out.includes("## Sub"));
  assert.ok(out.includes("### Deep"));
});

test("inline formatting maps to GFM", () => {
  const out = md(`<p><strong>b</strong> <em>i</em> <s>s</s> <code>c</code></p>`);
  assert.ok(out.includes("**b** *i* ~~s~~ `c`"));
});

test("markdown special characters in text are escaped", () => {
  const out = md(`<p>a * b _ c [d]</p>`);
  assert.ok(out.includes("a \\* b \\_ c \\[d\\]"));
});

test("ordered lists honor the start attribute", () => {
  const out = md(`<ol start="3"><li>third</li><li>fourth</li></ol>`);
  assert.ok(out.includes("3. third\n4. fourth"));
});

test("nested lists are indented under their parent item", () => {
  const out = md(`<ul><li>a<ul><li>b</li></ul></li></ul>`);
  assert.ok(out.includes("- a"));
  assert.ok(out.includes("  - b"));
});

test("tables become GFM tables with alignment and escaped pipes", () => {
  const out = md(
    `<table><tbody><tr><th>a</th><th style="text-align: center">b</th></tr>` +
    `<tr><td>1</td><td>b|c</td></tr></tbody></table>`,
  );
  assert.ok(out.includes("| a | b |"));
  assert.ok(out.includes("| --- | :---: |"));
  assert.ok(out.includes("| 1 | b\\|c |"));
});

test("multi-paragraph cells flatten with <br>", () => {
  const out = md(
    `<table><tr><th>h</th></tr><tr><td><p>one</p><p>two</p></td></tr></table>`,
  );
  assert.ok(out.includes("| one<br>two |"));
});

test("nested tables do not leak rows into the outer table", () => {
  const out = md(
    `<table><tr><th>outer</th></tr><tr><td><table><tr><td>inner</td></tr></table></td></tr></table>`,
  );
  const tableLines = out.split("\n").filter((l) => l.startsWith("|"));
  assert.equal(tableLines.length, 3); // header + separator + one body row
});

test("code macro becomes a fenced block with language and title", () => {
  const out = md(macro("code", param("language", "js") + param("title", "demo.js"), cdata("const a = 1;")));
  assert.ok(out.includes("**demo.js**"));
  assert.ok(out.includes("```js\nconst a = 1;\n```"));
});

test("fences escalate when the code itself contains triple backticks", () => {
  const out = md(macro("code", "", cdata("before ``` after")));
  assert.ok(out.includes("````\nbefore ``` after\n````"));
});

test("noformat becomes a plain fence", () => {
  const out = md(macro("noformat", "", cdata("raw <text>")));
  assert.ok(out.includes("```\nraw <text>\n```"));
});

test("task lists become GFM checkboxes", () => {
  const out = md(
    `<ac:task-list>` +
    `<ac:task><ac:task-status>complete</ac:task-status><ac:task-body>done</ac:task-body></ac:task>` +
    `<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>todo</ac:task-body></ac:task>` +
    `</ac:task-list>`,
  );
  assert.ok(out.includes("- [x] done"));
  assert.ok(out.includes("- [ ] todo"));
});

test("callouts become labelled blockquotes", () => {
  const out = md(macro("note", "", rich("<p>body</p>")));
  assert.ok(out.includes("> **Note**\n>\n> body"));
  const titled = md(macro("warning", param("title", "Careful"), rich("<p>x</p>")));
  assert.ok(titled.includes("> **Careful**"));
});

test("expand becomes a details block", () => {
  const out = md(macro("expand", param("title", "More"), rich("<p>hidden</p>")));
  assert.ok(out.includes("<details>\n<summary>More</summary>"));
  assert.ok(out.includes("hidden"));
  assert.ok(out.includes("</details>"));
});

test("status becomes bold text", () => {
  assert.ok(md(macro("status", param("title", "DONE"))).includes("**DONE**"));
});

test("jira becomes a link when a base URL is available", () => {
  const out = md(macro("jira", param("key", "PROJ-1") + param("baseurl", "https://j.example.com")));
  assert.ok(out.includes("[🎫 PROJ-1](https://j.example.com/browse/PROJ-1)"));
  const bare = md(macro("jira", param("key", "PROJ-1")));
  assert.ok(bare.includes("🎫 PROJ-1"));
  assert.ok(!bare.includes("]("));
});

test("mentions and anchors export portably", () => {
  assert.ok(md(macro("user-mention", param("display-name", "张三"))).includes("@张三"));
  assert.ok(md(macro("anchor", param("anchor-name", "x"))).includes('<a id="x"></a>'));
});

test("emoticons export as emoji glyphs", () => {
  assert.ok(md(macro("emoticon", param("name", "smile"))).includes("😊"));
  assert.ok(md(`<p>hi <ac:emoticon ac:name="cheese"/></p>`).includes("🧀"));
});

test("ac:link exports plain text offline and real links with baseUrl", () => {
  const offline = md(`<ac:link><ri:page ri:content-title="Setup Guide"/></ac:link>`);
  assert.ok(offline.includes("Setup Guide"));
  assert.ok(!offline.includes("]("));
  const online = md(
    `<ac:link><ri:page ri:content-title="Setup Guide" ri:space-key="DEV"/></ac:link>`,
    { baseUrl: "https://c.example.com" },
  );
  assert.ok(online.includes("[Setup Guide](https://c.example.com/display/DEV/Setup%20Guide)"));
});

test("ac:link attachments export as relative file links", () => {
  const out = md(`<ac:link><ri:attachment ri:filename="report.pdf"/></ac:link>`);
  assert.ok(out.includes("[📎 report.pdf](report.pdf)"));
});

test("ac:image exports as a portable image reference", () => {
  const out = md(`<ac:image ac:alt="diagram"><ri:attachment ri:filename="pic.png"/></ac:image>`);
  assert.ok(out.includes("![diagram](pic.png)"));
  const captioned = md(
    `<ac:image ac:alt="d"><ri:attachment ri:filename="p.png"/><ac:caption>cap</ac:caption></ac:image>`,
  );
  assert.ok(captioned.includes("![d](p.png)"));
  assert.ok(captioned.includes("*cap*"));
});

test("excerpt-include resolves same-page excerpts in either order", () => {
  const out = md(
    macro("excerpt-include", param("name", "s")) +
    macro("excerpt", param("name", "s"), rich("<p>shared</p>")),
  );
  assert.equal(out.match(/shared/g).length, 2);
});

test("hidden excerpts are omitted from export", () => {
  const out = md(macro("excerpt", param("hidden", "true"), rich("<p>secret</p>")));
  assert.ok(!out.includes("secret"));
});

test("toc macros are omitted (Markdown readers build their own)", () => {
  const out = md(macro("toc") + `<h1>X</h1>`);
  assert.ok(!out.includes("cf-toc"));
  assert.ok(out.includes("# X"));
});

test("children macro exports an offline note", () => {
  assert.ok(md(macro("children")).includes("Child pages"));
});

test("unknown macros degrade to their body or a note", () => {
  assert.ok(md(macro("galaxy", "", rich("<p>stuff</p>"))).includes("stuff"));
  assert.ok(md(macro("galaxy")).includes("*(galaxy macro)*"));
});

test("export ends with a single trailing newline and no triple blanks", () => {
  const out = md(`<h1>A</h1><p>b</p><p>c</p>`);
  assert.ok(out.endsWith("\n"));
  assert.ok(!out.endsWith("\n\n"));
  assert.ok(!/\n{3,}/.test(out));
});