/**
 * PreviewPanel — owns the lifecycle of the Confluence preview webview.
 *
 * Design:
 * - One singleton preview panel per VS Code window.
 * - Tracks the document the preview is currently bound to. Refresh only
 *   fires when that document emits a change.
 * - Source HTML is sent via postMessage; webview is just a renderer.
 */

import * as path from "node:path";
import * as vscode from "vscode";
import { parseConfluence } from "./parser";

export class PreviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private currentDoc: vscode.TextDocument | undefined;
  private currentDirty = false;
  private refreshTimer: NodeJS.Timeout | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  openForActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage(
        "Open a Confluence file (.confluence / .cfl / .html) first.",
      );
      return;
    }

    this.currentDoc = editor.document;
    this.showPanel();
    void this.refreshNow();
  }

  refresh(): void {
    void this.refreshNow();
  }

  onDocumentChanged(doc: vscode.TextDocument, debounce = false): void {
    // Only react if the change is for the doc we're currently previewing,
    // and only if a panel is actually visible.
    if (!this.panel || !this.currentDoc) return;
    if (doc.uri.toString() !== this.currentDoc.uri.toString()) return;

    this.currentDirty = doc.isDirty;
    if (debounce) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => void this.refreshNow(), 250);
    } else {
      void this.refreshNow();
    }
  }

  async copyRenderedHtml(): Promise<void> {
    if (!this.currentDoc) return;
    const { html } = parseConfluence(this.currentDoc.getText());
    await vscode.env.clipboard.writeText(html);
    void vscode.window.showInformationMessage("Rendered HTML copied to clipboard.");
  }

  async exportMarkdown(): Promise<void> {
    if (!this.currentDoc) return;
    const source = this.currentDoc.getText();
    const md = confluenceToMarkdown(source);
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        this.currentDoc.uri.fsPath.replace(/\.[^.]+$/, "") + ".md",
      ),
      filters: { Markdown: ["md"] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(md, "utf8"));
    void vscode.window.showInformationMessage(`Markdown exported to ${target.fsPath}`);
  }

  // ----------------------------------------------------------------------

  private showPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "confluencePreview",
      "Confluence Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, "dist", "media")),
        ],
      },
    );

    const mediaRoot = path.join(this.context.extensionPath, "dist", "media");
    const previewHtmlPath = vscode.Uri.file(path.join(mediaRoot, "preview.html"));
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaRoot, "style.css")),
    );
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaRoot, "script.js")),
    );
    const hlUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaRoot, "highlight.min.js")),
    );

    this.panel.webview.html = renderPreviewShell(
      previewHtmlPath.fsPath,
      styleUri.toString(),
      scriptUri.toString(),
      hlUri.toString(),
      this.panel.webview.cspSource,
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.currentDoc = undefined;
      this.currentDirty = false;
    });

    this.panel.webview.onDidReceiveMessage((msg) => {
      if (!msg || typeof msg !== "object") return;
      switch (msg.command) {
        case "ready":
          void this.refreshNow();
          break;
        case "navigate":
          void this.handleNavigate(msg.target as string);
          break;
        case "openLink":
          void this.handleOpenLink(msg.href as string);
          break;
      }
    });
  }

  private async handleNavigate(target: string): Promise<void> {
    if (!this.currentDoc) return;
    const text = this.currentDoc.getText();
    const idx = text.indexOf(`id="${target}"`);
    if (idx < 0) return;
    const pos = this.currentDoc.positionAt(idx);
    const editor = await vscode.window.showTextDocument(this.currentDoc);
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter,
    );
    editor.selection = new vscode.Selection(pos, pos);
  }

  private async handleOpenLink(href: string): Promise<void> {
    if (!href || href === "#") return;
    if (/^(javascript|data|vbscript):/i.test(href)) return;
    await vscode.env.openExternal(vscode.Uri.parse(href));
  }

  private async refreshNow(): Promise<void> {
    if (!this.panel || !this.currentDoc) return;
    const text = this.currentDoc.getText();
    let result;
    try {
      result = parseConfluence(text);
    } catch (e: any) {
      await this.panel.webview.postMessage({
        command: "render",
        payload: {
          title: this.currentDoc.fileName,
          html: `<div class="cf-error"><strong>Parse error:</strong><pre>${escapeText(
            String(e?.message ?? e),
          )}</pre></div>`,
          outline: [],
          warnings: [String(e?.message ?? e)],
          macros: [],
          dirty: false,
        },
      });
      return;
    }

    await this.panel.webview.postMessage({
      command: "render",
      payload: {
        title: this.currentDoc.fileName,
        html: result.html,
        outline: result.outline,
        warnings: result.warnings,
        macros: result.macros,
        dirty: this.currentDirty,
      },
    });
  }
}

// ----------------------------------------------------------------------

function renderPreviewShell(
  htmlPath: string,
  styleUri: string,
  scriptUri: string,
  hlUri: string,
  cspSource: string,
): string {
  // We don't read the file from disk in production because the webview
  // needs the assets inlined as URIs. Instead, generate the HTML shell
  // directly. This keeps things simple and lets us inject URIs/CSP.
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource};"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="stylesheet" href="${styleUri}"/>
<title>Confluence Preview</title>
</head>
<body class="vscode-light">
<div id="app">
  <header class="cf-header">
    <span class="cf-title" id="cf-title">Confluence Preview</span>
    <span class="cf-dirty" id="cf-dirty" hidden>● unsaved</span>
    <span class="cf-spacer"></span>
    <span class="cf-warning" id="cf-warning" hidden></span>
  </header>
  <main class="cf-main">
    <aside class="cf-outline-pane" id="cf-outline-pane">
      <div class="cf-outline-header">Outline</div>
      <nav class="cf-outline" id="cf-outline"></nav>
    </aside>
    <article class="cf-content" id="cf-content"></article>
  </main>
</div>
<script src="${hlUri}"></script>
<script src="${scriptUri}"></script>
</body>
</html>`;
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

/**
 * Convert Confluence storage format to basic Markdown.
 * This is a best-effort conversion (not round-trippable) but useful as
 * a quick export.
 */
function confluenceToMarkdown(source: string): string {
  // Strip macros (keep their text content where possible) and convert
  // standard HTML to Markdown.
  let text = source;

  // Drop <ac:structured-macro ...> wrappers but keep their text body.
  text = text.replace(
    /<ac:structured-macro[^>]*ac:name="([^"]+)"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g,
    (_m, name: string, body: string) => {
      const plain = (body.match(
        /<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/,
      ) ?? [, ""])[1] as string;
      const rich = (body.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/) ??
        [, ""])[1] as string;
      const inner = plain || rich;
      switch (name.toLowerCase()) {
        case "code":
          return "\n```\n" + plain.trim() + "\n```\n";
        case "note":
        case "info":
        case "warning":
        case "tip":
          return `\n> **${name.toUpperCase()}:** ${stripTags(inner)}\n`;
        case "panel":
          return `\n> ${stripTags(inner).replace(/\n/g, "\n> ")}\n`;
        case "quote":
          return `\n> ${stripTags(inner).replace(/\n/g, "\n> ")}\n`;
        case "status": {
          const m = inner.match(/title="?([^"\s>]+)"?/) ?? body.match(/title="([^"]+)"/);
          return `[${m?.[1] ?? "Status"}]`;
        }
        case "toc":
          return `\n*(Table of Contents — see source)*\n`;
        default:
          return stripTags(inner);
      }
    },
  );

  // Drop ac:link wrappers, keep page titles as plain text.
  text = text.replace(
    /<ac:link>[\s\S]*?<ri:page[^>]*ri:content-title="([^"]+)"[^>]*\/>[\s\S]*?<\/ac:link>/g,
    "$1",
  );
  text = text.replace(
    /<ac:link>[\s\S]*?<ri:url[^>]*ri:value="([^"]+)"[^>]*\/>[\s\S]*?<\/ac:link>/g,
    "$1",
  );
  text = text.replace(/<ac:link[^>]*>([\s\S]*?)<\/ac:link>/g, "$1");

  // Drop all remaining ac:* / ri:* tags (no content).
  text = text.replace(/<ac:[^>]+>/g, "");
  text = text.replace(/<ri:[^>]+>/g, "");

  // Convert HTML headings.
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, "\n# $1\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, "\n## $1\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, "\n### $1\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, "\n#### $1\n");
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/g, "\n##### $1\n");
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/g, "\n###### $1\n");

  // Inline formatting.
  text = text.replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, "**$2**");
  text = text.replace(/<(em|i)>([\s\S]*?)<\/\1>/g, "*$2*");
  text = text.replace(/<s[^>]*>([\s\S]*?)<\/s>/g, "~~$1~~");
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, "`$1`");

  // Links.
  text = text.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)");

  // Lists.
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, "- $1\n");
  text = text.replace(/<\/?(ul|ol)[^>]*>/g, "\n");

  // Paragraphs and breaks.
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, "\n$1\n");
  text = text.replace(/<br\s*\/?>/g, "\n");

  // Strip any remaining tags.
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities.
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Collapse 3+ blank lines.
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim() + "\n";
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}