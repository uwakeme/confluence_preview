# Project conventions — Confluence Preview

Short notes that every rein references. Keep this file under 80 lines — link out instead of inlining.

## Build & test pipeline

- **Bundle**: `esbuild` → `dist/extension.js` (CJS, `external: ["vscode"]`, target `node18`). Config lives in `esbuild.config.mjs`.
- **Typecheck**: `npx tsc --noEmit` (strict mode, Node16 modules, ES2022).
- **Tests**: `node --test tests/` — built-in Node test runner, `*.test.mjs` files only. **Do not introduce jest/vitest/mocha.**
- **Visual sanity check**: open `tests/test.confluence` in VS Code and run `Confluence: Open Preview` to eyeball the rendered output.
- **Debug**: F5 in VS Code; `.vscode/launch.json` runs `npm: watch` as preLaunchTask.

## Source layout rules

- `src/extension.ts` — entry only. No business logic here; just command registration + listeners.
- `src/previewPanel.ts` — webview lifecycle. The single source of truth for "is the preview open and which document is it showing".
- `src/parser/` — pure functions, no VS Code imports. Importable from `tests/` without an extension host.
- `src/media/` — copied verbatim by `esbuild.config.mjs#copyWebviewAssets()`. If you add/rename a file there, update the copy list in lockstep.
- `src/parser/macros/` — one file per macro renderer. Every renderer exports a single function with the fixed signature: `($, el, ctx, params, bodyHtml, rawCdata) => string`.

## Code conventions

- Indentation: 2 spaces, LF line endings.
- TypeScript strict mode (`strict: true`, `noImplicitAny: true`).
- All user-supplied text must go through `src/parser/sanitize.ts` before injection.
- Macro names are looked up case-insensitively in `REGISTRY`.
- The orchestrator / reins do **not** edit each other's files — cross-cutting changes go through the orchestrator.

## Commit & PR

- Branch from `main`; never push to `main` directly.
- Conventional commits (`feat:` / `fix:` / `docs:` / `refactor:` / `test:`).
- PR via `gh pr create` once `npm run build` + `npm test` + `npx tsc --noEmit` are green.

## Security reminders

- Webview CSP forbids network — do not introduce any fetch / XHR / external `<script>`.
- External `<img>` is intentionally a placeholder.
- No secrets in the repo. `.env`, `dist/`, `node_modules/`, and generated `*.bundle.mjs` are gitignored.