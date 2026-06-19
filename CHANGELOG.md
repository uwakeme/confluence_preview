# Changelog

All notable changes to **Confluence Preview** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-19

First public release. Confluence Storage Format preview, fully client-side.

### Added

**Preview & editor integration**
- Side-by-side preview pane that updates as you type (250 ms debounce, refresh on save).
- File-type registration for `*.confluence`, `*.cfl`, `*.confluence-storage`, plus any `*.html` containing Confluence markup.
- `Confluence: Open Preview`, `Confluence: Refresh Preview`, `Confluence: Copy Rendered HTML`, `Confluence: Export to Markdown` commands.
- Live `h1`–`h6` outline sidebar that tracks scroll position.

**Macro rendering**
- `code` — title, language, collapse, line numbers; syntax highlighting via `highlight.js`.
- `toc` / `table-of-contents` — placeholder marker + sidebar outline.
- `note` / `info` / `warning` / `tip` — color-coded callouts with icon.
- `panel` — customizable title and border via macro parameters.
- `expand` — collapsible block (`<details>` / `<summary>`).
- `excerpt` / `excerpt-include` — reusable snippet blocks.
- `quote` — styled blockquote.
- `noformat` — preformatted block, preserves CDATA verbatim.
- `status` — colored pill (grey / green / yellow / red / blue / purple).
- `jira` — issue link, respects `baseurl` parameter.
- `user-mention` — `@user` tag.
- `link` / `pagelink` — link macro with optional inline body.
- `section` / `column` — flex-row layout.
- `anchor` — in-page anchor target.
- `children` — placeholder (offline-safe).
- `emoticon` / `cheese` — emoji glyphs.
- Unknown macros render as a muted fallback box with the macro name and body.

**Structured links**
- `<ac:link><ri:page>`, `<ri:attachment>`, `<ri:url>`, `<ri:user>` resolve to inline links.
- Bare `<ri:page>` / `<ri:url>` used inline in text are also recognized.

**Standard HTML**
- All standard XHTML elements: `h1`–`h6`, `p`, formatting (`strong` / `em` / `u` / `s`), `sub` / `sup`, inline `code`, `pre`, `blockquote`, `ul` / `ol` / `li`, `a`, `img`, `table` / `thead` / `tbody` / `tr` / `th` / `td` (colspan / rowspan), `span`, `div`, `figure`, `figcaption`, `time`, `small`, `mark`, `cite`, `q`, `kbd`, `br`, `hr`.

**Quality & safety**
- CDATA pre-processing: every `<![CDATA[...]]>` block is base64-stashed before parse and decoded verbatim inside macro renderers, so code-macro bodies survive intact.
- XSS-safe by default — all user-supplied text is escaped via `sanitize.ts` helpers before injection.
- Theme-aware UI — adapts to VS Code's light, dark, and high-contrast themes.
- 100% offline — zero network calls, zero telemetry, suitable for air-gapped environments.
- Strict webview CSP — no remote scripts, no remote styles, no remote images.

**Developer surface**
- Pure-client-side parser (`src/parser/`) using `cheerio`; macro renderer registry in `src/parser/macros/registry.ts`.
- `parseConfluence()` returns a `RenderContext` with `html`, outline tree, macros seen, and warnings.
- Adding a new macro = one file in `src/parser/macros/` + one entry in the registry + one `*.test.mjs`.
- esbuild bundler — `npm run build` produces a single `dist/extension.js` (~600 KB) and copies webview assets.
- Node built-in test runner — `npm test` runs `tests/*.test.mjs`, no extra test framework.
- F5 debug launch via `.vscode/launch.json` with `preLaunchTask: npm: watch`.

### Known limitations
- Internal page / attachment links render as labeled placeholders, not real URLs (the extension has no Confluence host context).
- External `<img>` is blocked by CSP and shown as a placeholder.
- Preview is read-only — editing stays in Confluence's own Source Editor.
- Markdown export is best-effort; round-trip is not guaranteed.

[0.1.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.1.0