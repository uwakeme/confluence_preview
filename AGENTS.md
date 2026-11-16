# AGENTS.md

Preview **Confluence Storage Format** (the XHTML behind Confluence's Source Editor) as it renders in Confluence, inside a VS Code pane. Pure client-side, no server connection.

## Setup commands

- Install deps: `npm install`
- Build:        `npm run build`          # esbuild → dist/extension.js + copies media/
- Watch build:  `npm run watch`          # used by F5 debug launch
- Test:         `npm test`               # node --test (pretest bundles the parser first)
- Typecheck:    `npx tsc --noEmit`

## Project layout

- `src/extension.ts` — entry; registers commands (`openPreview`, `refresh`, `copyHtml`, `exportMarkdown`, `exportHtml`), the webview panel serializer, document-change and editor-scroll wiring
- `src/previewPanel.ts` — webview lifecycle, refresh / copy-HTML / export logic, settings-driven `ParseOptions`, local attachment resolution (confined to the source directory), standalone HTML export
- `src/links.ts` — pure URL helpers: `sanitizeHref`, `isAllowedExternalHref`, `buildPageUrl`, `buildJiraUrl` (no vscode imports, unit-testable)
- `src/parser/` — `parseConfluence()` / `confluenceToMarkdown()` public API
  - `index.ts` — entry; second pass resolves inline TOC and same-page excerpt-include markers
  - `source.ts` — CDATA → base64 placeholders, self-closing `ac:`/`ri:` tag expansion, cheerio loader, direct-child macro param/body readers
  - `elements.ts` — standard HTML recursion + `ac:image`, `ac:task-list`, `ac:layout`; `RenderContext` definition
  - `outline.ts` — h1–h6 outline tree with unique ids and source offsets (non-heading regions masked)
  - `markdown.ts` — tree-based GFM Markdown export
  - `sanitize.ts` — escape / slugify helpers + CSS allowlist validators (`sanitizeStyle`, `isCssColor`, …)
  - `types.ts` — `ParseResult`, `ParseOptions` (host capability callbacks)
  - `macros/` — one renderer per macro: code, toc, panel (also note/info/warning/tip), expand, status, excerpt (also excerpt-include), quote, noformat, children, anchor, jira, mention, layout (section/column), emoticon, link, fallback
  - `macros/registry.ts` — macro name → renderer lookup (also handles `<ac:link>` structured links)
- `src/media/` — webview assets (`style.css`, `script.js`, `highlight.min.js`) — copied into `dist/media/` by `esbuild.config.mjs`; the HTML shell is rendered inline by `previewPanel.ts`
- `package.nls.json` / `package.nls.zh-cn.json` — command / setting display strings
- `tests/test.confluence` — example Confluence source covering every supported macro and modern format (open in VS Code and run `Confluence: Open Preview` to inspect); `tests/sample-diagram.svg` is its local attachment
- `tests/` — Node test-runner suites (`*.test.mjs`: security, macros, elements, outline, toc-excerpt, markdown, links, parse) importing `./parser.bundle.mjs`
- `.github/workflows/ci.yml` — typecheck + build + test on push/PR; VSIX package on `v*` tags
- `confluence.configuration.json` — language config (brackets, auto-closing pairs) for the `confluence` language
- `.vscode/launch.json` — F5 launch config (`preLaunchTask: npm: watch`)

## Code style

- TypeScript strict mode (`tsconfig.json: strict: true, noImplicitAny: true`), Node16 modules, ES2022 target
- esbuild bundles `src/extension.ts` → `dist/extension.js` (CJS, `external: ["vscode"]`); webview assets copied verbatim — **no bundler on the browser side**
- Use `cheerio` (already in `dependencies`) for HTML parsing; do not add `jsdom` or other HTML parsers
- Indentation: 2 spaces, LF line endings, no trailing whitespace
- Run `npm test` and `npx tsc --noEmit` before committing

## Testing instructions

- Unit tests: `npm test` — Node's built-in test runner over `tests/*.test.mjs`; the `pretest` script bundles `src/parser/index.ts` → `tests/parser.bundle.mjs` (gitignored), which the suites import
- Add a `*.test.mjs` under `tests/` for every new parser behavior or macro renderer; assert on emitted HTML / outline / warnings
- Keep `tests/test.confluence` warning-free — `parse.test.mjs` asserts it parses with zero warnings
- After parser changes, open `tests/test.confluence` in VS Code with the preview pane to eyeball visual fidelity
- All tests must pass before pushing

## Commit & push conventions

- Commit message: conventional commits (`feat:` / `fix:` / `docs:` / `refactor:` / `test:`)
- Push directly to `main` — no PR required (personal project, no reviewers)
- Either HTTPS or SSH works; if one is blocked by the network, switch with `git remote set-url origin <other-url>`

## Changelog

- Every commit with a user-visible effect (UI change, new feature, behavior fix, macro support, etc.) must update `CHANGELOG.md` and `CHANGELOG.en.md` in the same commit. Unreleased work accumulates under an `## [Unreleased]` section at the top of both files; cut a versioned section + bump `package.json` when releasing.
- Style: **user-perspective only**. Describe what the user can now see and do — not how it's implemented. No file names, function names, regex / CSS / TS details, refactor rationale, or internal naming. One bullet ≈ one observable change.
- Follow [Keep a Changelog](https://keepachangelog.com/) section types: 新增 / 修复 / Changed / 弃用 / 移除 / 安全 (English: Added / Fixed / Changed / Deprecated / Removed / Security). Use only the ones that apply; don't invent new ones.
- Purely internal commits (e.g. `chore: bump dep`, `docs: fix typo in AGENTS.md`, behavior-preserving refactor with no UX impact) can skip the changelog — but if there's *any* user-visible side effect, document it.

## Security

- Never commit secrets — `.env` is in `.gitignore` (along with `node_modules/`, `dist/`, generated `*.bundle.mjs`)
- Webview runs under a strict CSP — do not introduce network calls; the extension is intentionally offline
- External `<img>` / `ri:url` images are intentionally blocked; only local files (via the host's confined resolver) and `data:image` render
- All macro output is HTML — every renderer must escape user-supplied text via `sanitize.ts` helpers before injecting
- Anything landing in a `style` attribute must pass the `sanitize.ts` allowlist validators; anything landing in an `href` must pass `sanitizeHref`; anything opened externally must pass `isAllowedExternalHref`
- Local attachment resolution stays inside the source file's directory (realpath containment check in `previewPanel.ts`)