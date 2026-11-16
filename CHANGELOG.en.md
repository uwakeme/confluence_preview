<div align="right">

**[简体中文](./CHANGELOG.md)**

</div>

# Changelog

All notable changes to **Confluence Preview** are listed here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-16

### Added

#### Top banner

The README now opens with a dark banner image showing the project name, a one-line summary, and the tech stack tags.

#### Preview and export

- New command "Confluence: Export Standalone HTML": saves a single HTML file with styles and syntax highlighting inlined — opens in any browser and follows the system light/dark theme.
- Keyboard shortcut `Ctrl+Shift+V` (`Cmd+Shift+V` on macOS) opens the preview; the editor context menu offers it too.
- A refresh button appears in the editor title bar while a preview is open; "Refresh Preview" is back in the Command Palette.
- Scrolling the editor moves the preview to the matching section; double-clicking a preview heading jumps back to the source.
- The preview survives a VS Code window reload — no need to reopen it.
- The outline sidebar can be hidden/shown anytime from the preview header, and your choice is remembered.
- UI strings are available in English and Chinese, following the VS Code display language.

#### Content rendering

- Images: `ac:image` attachments and relative `<img>` paths render directly when the file sits next to the source, with dimensions, borders and captions; local attachment links open on click.
- Task lists: `ac:task-list` renders as a checklist with completion state.
- Modern page layouts: Confluence Cloud `ac:layout` (equal columns, three columns, left/right sidebars) renders correctly and wraps on narrow screens.
- In-page table of contents: the `toc` macro now renders in the document body, with level ranges and flat/tree styles.
- Same-page excerpt includes: `excerpt-include` expands excerpts defined in the same document, even when the definition comes later.
- Code line numbers: the `linenumbers` and `firstline` parameters now work, numbering from the requested line.
- Table upgrades: cell background highlights, column widths, alignment and merged cells all render correctly.
- Colored text: safe inline styles (color, background, alignment) are preserved.
- Custom link text: plain-text and rich link bodies on `ac:link` render correctly.

#### Settings

- `baseUrl`: set your Confluence URL and internal page links become real links.
- `jiraBaseUrl`: set your Jira URL and issue keys become real links.
- `localFiles`: toggle local attachment/image resolution.
- `refreshDebounce`: adjustable refresh delay.
- `outlineVisible`: default outline visibility.
- `enableForHtml`: opt in to previewing plain `.html` files (off by default).

### Fixed

- Text following self-closing tags (`<ri:page/>`, emoticons, …) is no longer swallowed.
- Nested macro parameters no longer leak into the outer macro: a panel title is no longer overwritten by an inner code title.
- Duplicate headings get distinct anchors, so outline jumps land on the right section.
- Decoy headings inside code blocks and comments no longer appear in the outline.
- CDATA-wrapped parameters and code content are no longer lost.
- Entity text (`&amp;` etc.) no longer shows up double-escaped.
- `status` macro colors, titles and the subtle variant now work.
- `jira` macros without a baseurl render a badge instead of a dead link.
- `user-mention` supports the newer account-id parameter and no longer renders blank.
- `anchor` macros accept legacy parameter formats.
- Refreshing keeps your reading position and expanded sections instead of resetting them.
- The outline highlight correctly tracks scrolling.
- Image placeholders for missing attachments show the right dimensions.
- Structured `emoticon` macros read their name parameter correctly.
- The version badge at the top of the README showed a stale version number. It now matches the released version.

### Changed

- Markdown export rewritten: tables (with alignment and escaping), task lists, nested lists, code fences, details blocks and macro conversions stay much closer to the original structure.
- Command names unified to "Confluence: Open Preview / Refresh Preview / Copy Rendered HTML / Export to Markdown".
- Unknown macros now raise a warning count in the preview header.
- Plain `.html` files are no longer taken over by default — opt in via the setting.

### Security

- Malicious style injection (`url()`, `expression()`, …) is blocked by an allowlist.
- `javascript:` / `data:` / `vbscript:` links are neutralized.
- External images are never loaded; the webview Content Security Policy is tighter.
- Local attachment resolution is confined to the source file's directory — no reading outside it.
- External links pass a protocol allowlist before opening.

## [0.1.2] - 2026-08-03

### Changed

#### Outline sidebar

- Headings now render with level-specific typography: h1 is the largest and boldest, deeper levels get progressively smaller and lighter, and h5 is uppercase. The hierarchy of a document is visible at a glance.
- Each heading now has a clickable chevron in front of it that collapses and expands its subtree, so long documents are easier to navigate.
- Collapse state persists across document refreshes and reopening the file.
- Leaf headings (with no children) keep an invisible placeholder so their text lines up with non-leaf siblings instead of drifting left.
- The chevron rotates 90° when a subtree is open, giving a smooth open/close affordance.

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

[0.2.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.2.0
[0.1.0]: https://github.com/uwakeme/confluence_preview/releases/tag/v0.1.0
