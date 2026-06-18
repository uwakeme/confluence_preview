/**
 * Shared types for the parser.
 */

import type { OutlineNode } from "./outline";

export interface ParseResult {
  /** Rendered HTML body (safe to inject into a webview) */
  html: string;
  /** Outline tree extracted from h1-h6 */
  outline: OutlineNode[];
  /** Macro names that were rendered (for diagnostics / future tooling) */
  macros: string[];
  /** Any non-fatal warnings produced during parsing. */
  warnings: string[];
}

export interface OutlineCollector {
  collect(level: number, el: any, text: string): string;
  finalize(): OutlineNode[];
}