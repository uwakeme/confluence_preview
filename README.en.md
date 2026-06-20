<div align="right">

**[简体中文](./README.md)**

</div>

<div align="center">

# Confluence Preview

Preview Confluence Storage Format (XHTML) inside VS Code.

[Features](#features) · [Quick start](#quick-start) · [Commands](#commands) · [Supported elements](#supported-elements) · [FAQ](#faq)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.75.0-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Offline](https://img.shields.io/badge/runs-100%25%20offline-success)](#why)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)]()

A fully client-side VS Code extension. Open a `.confluence` file and the rendered page sits next to the source, refreshing on every keystroke. No Confluence connection, no network calls, no telemetry.

![Main window preview](image/preview-1.png)
Source on the left, outline and rendered page on the right.

</div>

---

## Why

Writing in Confluence's Source Editor means staring at a wall of `<ac:structured-macro>` tags. To see the result, you paste it back into Confluence, hit Preview, squint, go fix something, and repeat. This extension skips that loop. Open the file in VS Code and the rendered page shows up beside the source, refreshing as you type. No publishing, no round-trips.

The parser runs entirely on your machine, so it works on planes, in subways, and inside air-gapped networks.

---

## Features

| | |
|---|---|
| **Side-by-side preview**: rendered page appears beside the editor, auto-refreshes on edit or save. | **Live outline sidebar**: every `h1`–`h6` is collected into a clickable tree that tracks the scroll position. |
| **Full macro support**: `code`, `toc`, `panel`, `note` / `info` / `warning` / `tip`, `expand`, `status`, `jira`, `user-mention`, `link` / `pagelink`, `section` / `column`, `excerpt` / `excerpt-include`, `quote`, `noformat`, `anchor`, `children`, `emoticon` / `cheese`. Unknown macros fall back to a muted box. | **Syntax-highlighted code blocks**: JSON, TypeScript, SQL, anything `highlight.js` knows about, themed to match VS Code. |
| **Structured-link resolution**: `<ac:link>` with `ri:page` / `ri:attachment` / `ri:url` / `ri:user` render as proper inline links. | **Theme-aware**: adapts to VS Code's light, dark, and high-contrast themes. |
| **XSS-safe by default**: every user-supplied string is escaped before rendering. | **Export anywhere**: copy the rendered HTML to the clipboard, or save the document as Markdown. |

### Macro showcase

| | |
|---|---|
| **Code blocks and tables**: collapsible panels, line numbers, JSON / TS / SQL highlighting.<br><br>![Code blocks and table rendering](image/preview-2.png) | **Color-coded callouts**: `note`, `info`, `warning`, `tip`.<br><br>![Note and Info callout macros](image/preview-3.png) |
| **Layout and folding**: `panel`, `section` / `column`, `expand`, `quote`, `noformat`, `excerpt`.<br><br>![Panel, section/column, expand, quote, noformat, excerpt](image/preview-4.png) | **Status, jira, mentions, links, XSS test**: colored pills, ticket links, @mentions, page / attachment / user / URL links, escaped HTML.<br><br>![Status pills, jira, user mention, structured links, XSS test](image/preview-5.png) |

---

## Quick start

> About two minutes from clone to preview.

1. **Install and build**
   ```sh
   npm install
   npm run build
   ```
2. **Launch the extension**: open this folder in VS Code and press F5. A new Extension Development Host window opens.
3. **Open a sample**: in the new window, open `tests/test.confluence` (covers every supported macro), then `Ctrl+Shift+P` → `Confluence: Open Preview`.

Edit on the left, preview on the right.

---

## File types

These filename patterns are registered as the `confluence` language:

- `*.confluence`
- `*.cfl`
- `*.confluence-storage`

`.html` files are also handled through the `html` language fallback, so you can preview arbitrary Confluence markup without renaming.

---

## Commands

| Command | What it does |
|---|---|
| `Confluence: Open Preview` | Opens or focuses the preview pane beside the active editor |
| `Confluence: Refresh Preview` | Forces an immediate re-render |
| `Confluence: Copy Rendered HTML` | Copies the rendered HTML to the clipboard |
| `Confluence: Export to Markdown` | Saves the document as best-effort Markdown |

---

## Supported elements

### Macros

| Macro | Notes |
|---|---|
| `code` | title, language, collapse, line numbers; syntax highlighting via `highlight.js` |
| `toc` / `table-of-contents` | placeholder marker plus the full sidebar outline |
| `note` / `info` / `warning` / `tip` | color-coded callouts with icon |
| `panel` | customizable title and border via macro params |
| `expand` | collapsible block (`<details>`) |
| `excerpt` / `excerpt-include` | reusable snippet blocks |
| `quote` | styled blockquote |
| `status` | colored pill (grey, green, yellow, red, blue, purple) |
| `jira` | issue link (uses the `baseurl` param) |
| `user-mention` | @user tag |
| `link` / `pagelink` | link macro with optional inline body |
| `section` / `column` | flex-row layout |
| `noformat` | preformatted block (preserves CDATA verbatim) |
| `anchor` | in-page anchor target |
| `children` | placeholder (offline) |
| `emoticon` / `cheese` | emoji glyphs |
| *unknown* | muted fallback box with macro name and body |

### Standard HTML

All standard XHTML elements: `h1`–`h6`, `p`, `strong` / `em` / `u` / `s`, `sub` / `sup`, inline `code`, `pre`, `blockquote`, `ul` / `ol` / `li`, `a`, `img`, `table` / `thead` / `tbody` / `tr` / `th` / `td` (colspan / rowspan), `span`, `div`, `figure`, `figcaption`, `time`, `small`, `mark`, `cite`, `q`, `kbd`, `br`, `hr`.

### Structured links

- `<ac:link><ri:page ri:content-title="…"/></ac:link>` → blue inline link
- `<ac:link><ri:attachment ri:filename="…"/></ac:link>` → 📎 attachment link
- `<ac:link><ri:url ri:value="…"/></ac:link>` → external link
- `<ac:link><ri:user ri:username="…"/></ac:link>` → @user mention
- `<ri:page>` and friends used inline in text are also resolved

---

## FAQ

**Does this extension need a Confluence account?**
No. It's a pure-local parser and doesn't connect to anything. Your source never leaves your machine.

**Can I use it offline or in classified environments?**
Yes. There are no network calls, no telemetry, no auto-update pings. It passes air-gap and classified-network reviews.

**Will it follow links to other Confluence pages?**
Not by default. Without knowing your Confluence host, internal page and attachment links render as labeled placeholders. If you want them to resolve, set the `baseurl` parameter on the `jira` macro (and similar) inside your source.

**Why doesn't the preview update?**
Run `Confluence: Refresh Preview` from the Command Palette. The default behavior is debounced 250 ms, so a manual nudge helps after a large paste.

**Can I edit in the preview?**
No, the preview is read-only. For editing, use VS Code on the `.confluence` file directly. Source Control works as normal.

**Can I add my own macros?**
Yes, see the *For developers* section below. Each macro is a single TypeScript file in `src/parser/macros/`. Add an entry to `registry.ts` and you're done.

---

## Limitations

- **No live network calls.** `<ac:link><ri:page .../></ac:link>` and `<ac:link><ri:attachment .../></ac:link>` render as inline placeholders with the title or filename. They don't resolve to real Confluence URLs, since the extension doesn't know your Confluence host.
- **No image loading.** External `<img>` is shown as a placeholder to satisfy the webview's CSP and keep the extension offline-only.
- **Read-only preview.** To edit, you still use Confluence's own Source Editor.
- **Markdown export is best-effort.** It strips most markup and turns macros into their nearest Markdown equivalent. Round-trip is not guaranteed.

---

<details>
<summary><h2>For developers</h2></summary>

### Architecture

```
┌─────────────────────┐                ┌──────────────────────┐
│  Confluence source  │   parse        │  RenderContext       │
│  (XHTML + ac:/ri:)  │ ─────────────► │   - html             │
│                     │                │   - outline tree     │
└─────────────────────┘                │   - macros seen      │
                                          │   - warnings         │
                                          └─────────┬────────────┘
                                                    │ postMessage
                                                    ▼
                                          ┌──────────────────────┐
                                          │  Webview (CSP-safe)  │
                                          │   - style.css        │
                                          │   - script.js        │
                                          │   - highlight.min.js │
                                          └──────────────────────┘
```

#### Pre-processing: CDATA

Confluence source uses XML CDATA blocks (`<![CDATA[ ... ]]>`) to keep code verbatim. Browsers' HTML parsers treat CDATA as comments, which would destroy code-macro bodies. We work around this by replacing every CDATA block with a `<cf-cdata data-b64="…">` placeholder before parsing, then decoding the base64 back to raw text inside each macro renderer.

#### Macro routing

`src/parser/macros/registry.ts` maps every supported macro name to a renderer function. Each renderer receives:

- the parsed cheerio node
- a shared `RenderContext` (used for outline collection)
- the parsed `<ac:parameter>` map
- the rendered rich-text-body HTML (or `""`)
- the raw CDATA text (or `""`)

Unknown macro names fall through to `fallbackMacro`, which shows a muted box with the macro name and body.

### Project layout

```
confluence_preview/
├── package.json              # extension manifest + scripts
├── tsconfig.json
├── esbuild.config.mjs        # bundler config (also copies media/)
├── .vscode/launch.json       # F5 debug config
├── src/
│   ├── extension.ts          # extension entry, command wiring
│   ├── previewPanel.ts       # preview webview lifecycle + commands
│   ├── parser/
│   │   ├── index.ts          # public parseConfluence()
│   │   ├── elements.ts       # standard HTML recursion
│   │   ├── outline.ts        # h1–h6 outline tree builder
│   │   ├── sanitize.ts       # escape / slugify helpers
│   │   ├── types.ts
│   │   └── macros/           # one renderer per macro
│   └── media/                # webview assets (html, css, js, hljs)
├── image/                    # README screenshots
└── tests/
    └── test.confluence       # full coverage of every macro
```

### Development commands

| Command | What it does |
|---|---|
| `npm install` | install dependencies |
| `npm run build` | bundle `src/extension.ts` → `dist/extension.js` |
| `npm run watch` | rebuild on change (used by F5 debug launch) |
| `npm test` | run Node test runner over `tests/*.test.mjs` |
| `npx tsc --noEmit` | typecheck |

### Adding a new macro

1. Create `src/parser/macros/<name>.ts` exporting a `render<Name>Macro` function.
2. Add it to `REGISTRY` in `src/parser/macros/registry.ts`.
3. Add a test under `tests/<name>.test.mjs` and assert on the emitted HTML.
4. Run `npm test` and `npx tsc --noEmit`, then eyeball the rendered output.

</details>

---

## License

MIT, see [LICENSE](./LICENSE).

## Acknowledgments

- Built on [cheerio](https://cheerio.js.org/) for HTML parsing.
- Syntax highlighting by [highlight.js](https://highlightjs.org/).
- Designed for VS Code ≥ 1.75.
