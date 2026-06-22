<div align="right">

**[简体中文](./CHANGELOG.md)**

</div>

# Changelog

All notable changes to **Confluence Preview** are listed here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-19

First public release. We render Confluence Storage Format inside VS Code, fully client-side. No network calls.

### Added

#### Preview & editor integration

Open a `.confluence` file and the rendered page sits next to it, refreshing on every keystroke (250 ms debounce) and on save. Registered file types: `*.confluence`, `*.cfl`, `*.confluence-storage`, plus any `*.html` containing Confluence markup.

Four commands: `Confluence: Open Preview`, `Confluence: Refresh Preview`, `Confluence: Copy Rendered HTML`, `Confluence: Export to Markdown`.

A `h1`–`h6` outline sits on the right and highlights the current section as you scroll.

#### Macro rendering

`code` supports title, language, collapse, and line numbers; highlighting comes from `highlight.js`. `toc` / `table-of-contents` paints a placeholder marker. The real outline is in the sidebar. `note` / `info` / `warning` / `tip` are four color-coded callout blocks with icons. `panel` lets you set title and border color via macro parameters. `expand` is a collapsible block (`<details>` / `<summary>`). `excerpt` / `excerpt-include` are reusable snippet blocks. `quote` is a styled blockquote. `noformat` keeps CDATA byte-for-byte. `status` is a colored pill in grey / green / yellow / red / blue / purple.

`jira` resolves issue links and reads the `baseurl` parameter. `user-mention` is the `@user` tag. `link` / `pagelink` is a link macro with optional body. `section` / `column` is a flex-row layout. `anchor` is an in-page target. `children` is a placeholder (offline-safe; we never reach out to Confluence). `emoticon` / `cheese` render emoji glyphs.

Unknown built-in macros fall back to a muted box with the macro name and body. We don't crash, and we don't pretend it rendered.

#### Structured links

`<ac:link><ri:page>`, `<ri:attachment>`, `<ri:url>`, and `<ri:user>` resolve to inline links. Bare `<ri:page>` / `<ri:url>` used inline in text are recognized the same way.

#### Standard HTML

Full coverage: `h1`–`h6`, `p`, inline formatting (`strong` / `em` / `u` / `s`), `sub` / `sup`, inline `code`, `pre`, `blockquote`, `ul` / `ol` / `li`, `a`, `img`, `table` / `thead` / `tbody` / `tr` / `th` / `td` (with `colspan` / `rowspan`), `span`, `div`, `figure`, `figcaption`, `time`, `small`, `mark`, `cite`, `q`, `kbd`, `br`, `hr`.

#### Quality & safety

CDATA is base64-stashed before parsing and restored verbatim at render time. Code bodies in `code` macros survive parsing intact.

All user text is escaped via `sanitize.ts` before injection. The UI matches VS Code's light, dark, and high-contrast themes. Zero network calls, zero telemetry; the extension runs in air-gapped environments. Webview CSP is strict: no remote scripts, styles, or images.

### Known limitations

Internal page / attachment links render as labeled placeholders, not real URLs (the extension has no Confluence host context). External `<img>` is blocked by CSP and shown as a placeholder. The preview is read-only; edit in Confluence's own source editor. Markdown export is best-effort; round-trip is not guaranteed.

[0.1.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.1.0
