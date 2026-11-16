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

/**
 * Host-provided capabilities. The parser stays pure: all I/O (file
 * existence checks, webview URI minting) happens behind these callbacks.
 */
export interface ParseOptions {
  /** Confluence base URL, enables real links for ri:page references. */
  baseUrl?: string;
  /** Default Jira base URL for jira macros without a baseurl parameter. */
  jiraBaseUrl?: string;
  /**
   * Resolve an attachment filename / relative path to a loadable URI
   * (webview-safe). Return undefined when the file is not available.
   */
  resolveLocalFile?: (filename: string) => string | undefined;
}