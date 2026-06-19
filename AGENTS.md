# AGENTS.md

Preview **Confluence Storage Format** (the XHTML behind Confluence's Source Editor) as it renders in Confluence, inside a VS Code pane. Pure client-side, no server connection.

## Setup commands

- Install deps: `npm install`
- Build:        `npm run build`          # esbuild → dist/extension.js + copies media/
- Watch build:  `npm run watch`          # used by F5 debug launch
- Test:         `npm test`               # node --test tests/ (built-in Node test runner)
- Typecheck:    `npx tsc --noEmit`

## Project layout

- `src/extension.ts` — entry; registers commands (`openPreview`, `refresh`, `copyHtml`, `exportMarkdown`) and document-change wiring
- `src/previewPanel.ts` — webview lifecycle, refresh / copy-HTML / export-markdown logic
- `src/parser/` — `parseConfluence()` public API
  - `index.ts` — entry, CDATA pre-processing
  - `elements.ts` — standard HTML recursion (h1–h6, p, ul/ol, table, links, …)
  - `outline.ts` — h1–h6 outline tree builder
  - `sanitize.ts` — escape / slugify helpers
  - `types.ts` — `RenderContext` etc.
  - `macros/` — one renderer per macro: code, toc, panel, note, info, warning, tip, expand, status, excerpt, excerpt-include, quote, noformat, children, anchor, jira, user-mention, section, column, emoticon, link, fallback
  - `macros/registry.ts` — macro name → renderer lookup (also handles `<ac:link>` structured links)
- `src/media/` — webview assets (`preview.html`, `style.css`, `script.js`, `highlight.min.js`) — copied into `dist/media/` by `esbuild.config.mjs`
- `tests/test.confluence` — example Confluence source covering every supported macro (open in VS Code and run `Confluence: Open Preview` to inspect)
- `tests/` — Node test-runner tests (`*.test.mjs`) and example Confluence sources
- `confluence.configuration.json` — language config (brackets, auto-closing pairs) for the `confluence` language
- `.vscode/launch.json` — F5 launch config (`preLaunchTask: npm: watch`)

## Code style

- TypeScript strict mode (`tsconfig.json: strict: true, noImplicitAny: true`), Node16 modules, ES2022 target
- esbuild bundles `src/extension.ts` → `dist/extension.js` (CJS, `external: ["vscode"]`); webview assets copied verbatim — **no bundler on the browser side**
- Use `cheerio` (already in `dependencies`) for HTML parsing; do not add `jsdom` or other HTML parsers
- Indentation: 2 spaces, LF line endings, no trailing whitespace
- Run `npm test` and `npx tsc --noEmit` before committing

## Testing instructions

- Unit tests: `npm test` — `node --test tests/` (Node's built-in test runner, `*.test.mjs` files)
- Add a `*.test.mjs` under `tests/` for every new parser behavior or macro renderer; assert on emitted HTML / outline / warnings
- After parser changes, open `tests/test.confluence` in VS Code with the preview pane to eyeball visual fidelity
- All tests must pass before opening a PR

## PR & commit conventions

- Branch from `main`; never push to it directly
- Commit message: conventional commits (`feat:` / `fix:` / `docs:` / `refactor:` / `test:`)
- Open PR via `gh pr create` once CI is green

## Security

- Never commit secrets — `.env` is in `.gitignore` (along with `node_modules/`, `dist/`, generated `*.bundle.mjs`)
- Webview runs under a strict CSP — do not introduce network calls; the extension is intentionally offline
- External `<img>` is intentionally blocked to avoid CSP / offline-only violations
- All macro output is HTML — every renderer must escape user-supplied text via `sanitize.ts` helpers before injecting