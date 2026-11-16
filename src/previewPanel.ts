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
import { statSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as vscode from "vscode";
import { parseConfluence, confluenceToMarkdown } from "./parser";
import type { OutlineNode, ParseOptions } from "./parser";
import { isAllowedExternalHref } from "./links";
import { escapeHtml } from "./parser/sanitize";

export class PreviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private currentDoc: vscode.TextDocument | undefined;
  private currentDirty = false;
  private refreshTimer: NodeJS.Timeout | undefined;
  private lastOutline: OutlineNode[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  // --------------------------------------------------------------------
  // Public command surface
  // --------------------------------------------------------------------

  openForActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage(
        "Open a Confluence file (.confluence / .cfl) first.",
      );
      return;
    }
    if (!this.isSupported(editor.document)) {
      void vscode.window.showInformationMessage(
        "This file is not a Confluence document. For .html files, enable confluence-previewer.enableForHtml.",
      );
      return;
    }
    this.bindDoc(editor.document);
    this.showPanel();
    void this.refreshNow();
  }

  refresh(): void {
    void this.refreshNow();
  }

  onDocumentChanged(doc: vscode.TextDocument, debounce = false): void {
    if (!this.panel || !this.currentDoc) return;
    if (doc.uri.toString() !== this.currentDoc.uri.toString()) return;

    this.currentDirty = doc.isDirty;
    if (debounce) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      const ms = this.config().get<number>("refreshDebounce", 250);
      this.refreshTimer = setTimeout(() => void this.refreshNow(), Math.max(0, ms));
    } else {
      void this.refreshNow();
    }
  }

  /** Editor scrolled → keep the preview at the corresponding heading. */
  onEditorScroll(editor: vscode.TextEditor): void {
    if (!this.panel || !this.panel.visible || !this.currentDoc) return;
    if (editor.document.uri.toString() !== this.currentDoc.uri.toString()) return;
    const topLine = editor.visibleRanges[0]?.start.line ?? 0;

    let target: OutlineNode | undefined;
    for (const node of flattenOutline(this.lastOutline)) {
      if (node.sourceOffset === undefined) continue;
      const line = this.currentDoc.positionAt(node.sourceOffset).line;
      if (line <= topLine) target = node;
      else break;
    }
    if (target) {
      void this.panel.webview.postMessage({ command: "syncScroll", target: target.id });
    }
  }

  async copyRenderedHtml(): Promise<void> {
    const doc = this.targetDoc();
    if (!doc) return this.noDocumentMessage();
    const { html } = parseConfluence(doc.getText(), this.parseOptions());
    await vscode.env.clipboard.writeText(html);
    void vscode.window.showInformationMessage("Rendered HTML copied to clipboard.");
  }

  async exportMarkdown(): Promise<void> {
    const doc = this.targetDoc();
    if (!doc) return this.noDocumentMessage();
    const md = confluenceToMarkdown(doc.getText(), this.parseOptions());
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(doc.uri.fsPath.replace(/\.[^.]+$/, "") + ".md"),
      filters: { Markdown: ["md"] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(md, "utf8"));
    void vscode.window.showInformationMessage(`Markdown exported to ${target.fsPath}`);
  }

  async exportStandaloneHtml(): Promise<void> {
    const doc = this.targetDoc();
    if (!doc) return this.noDocumentMessage();
    const result = parseConfluence(doc.getText(), this.parseOptions());
    const html = await this.buildStandaloneHtml(result.html, path.basename(doc.fileName));
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(doc.uri.fsPath.replace(/\.[^.]+$/, "") + ".html"),
      filters: { HTML: ["html"] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(html, "utf8"));
    void vscode.window.showInformationMessage(`Standalone HTML exported to ${target.fsPath}`);
  }

  /** Called by the webview panel serializer on window reload. */
  async restore(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    this.panel = panel;
    this.attachPanel(panel);
    const uri = (state as { uri?: string } | undefined)?.uri;
    if (!uri) return;
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      this.bindDoc(doc);
      void this.refreshNow();
    } catch {
      // Document no longer exists — leave the empty shell.
    }
  }

  // --------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("confluence-previewer");
  }

  private isSupported(doc: vscode.TextDocument): boolean {
    if (doc.languageId === "confluence") return true;
    if (/\.(confluence|cfl|confluence-storage)$/i.test(doc.fileName)) return true;
    if (doc.languageId === "html") return this.config().get<boolean>("enableForHtml", false);
    return false;
  }

  /** The bound document, or the active editor when no preview is open. */
  private targetDoc(): vscode.TextDocument | undefined {
    if (this.currentDoc) return this.currentDoc;
    const editor = vscode.window.activeTextEditor;
    if (editor && this.isSupported(editor.document)) return editor.document;
    return undefined;
  }

  private noDocumentMessage(): void {
    void vscode.window.showInformationMessage(
      "Open a Confluence file (or its preview) first.",
    );
  }

  private bindDoc(doc: vscode.TextDocument): void {
    this.currentDoc = doc;
    this.currentDirty = doc.isDirty;
    if (this.panel) {
      this.panel.title = `Confluence Preview — ${path.basename(doc.fileName)}`;
    }
  }

  private parseOptions(): ParseOptions {
    const cfg = this.config();
    const localFiles = cfg.get<boolean>("localFiles", true);
    return {
      baseUrl: cfg.get<string>("baseUrl", ""),
      jiraBaseUrl: cfg.get<string>("jiraBaseUrl", ""),
      resolveLocalFile: localFiles
        ? (filename) => {
            const abs = this.resolveLocalPath(filename);
            if (!abs || !this.panel) return undefined;
            return this.panel.webview.asWebviewUri(vscode.Uri.file(abs)).toString();
          }
        : undefined,
    };
  }

  /**
   * Resolve an attachment filename against the source file's directory.
   * Confined to that directory tree (no traversal, no remote URLs).
   */
  private resolveLocalPath(filename: string): string | undefined {
    if (!this.currentDoc || !filename || filename.includes("\0")) return undefined;
    if (/^[a-z][a-z0-9+.-]*:/i.test(filename)) return undefined;
    if (path.isAbsolute(filename)) return undefined;
    const docDir = path.dirname(this.currentDoc.uri.fsPath);
    const abs = path.resolve(docDir, filename);
    try {
      const real = realpathSync(abs);
      const realDir = realpathSync(docDir);
      if (real !== realDir && !real.startsWith(realDir + path.sep)) return undefined;
      if (!statSync(real).isFile()) return undefined;
      return real;
    } catch {
      return undefined;
    }
  }

  private showPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const mediaRoot = path.join(this.context.extensionPath, "dist", "media");
    const roots = [
      vscode.Uri.file(mediaRoot),
      ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri),
    ];
    if (this.currentDoc) {
      roots.push(vscode.Uri.file(path.dirname(this.currentDoc.uri.fsPath)));
    }

    const panel = vscode.window.createWebviewPanel(
      "confluencePreview",
      this.currentDoc
        ? `Confluence Preview — ${path.basename(this.currentDoc.fileName)}`
        : "Confluence Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: roots,
      },
    );
    this.panel = panel;
    this.attachPanel(panel);
  }

  private attachPanel(panel: vscode.WebviewPanel): void {
    const mediaRoot = path.join(this.context.extensionPath, "dist", "media");
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaRoot, "style.css")));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaRoot, "script.js")));
    const hlUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(mediaRoot, "highlight.min.js")));

    panel.webview.html = renderPreviewShell(
      styleUri.toString(),
      scriptUri.toString(),
      hlUri.toString(),
      panel.webview.cspSource,
    );

    panel.onDidDispose(() => {
      this.panel = undefined;
      this.currentDoc = undefined;
      this.currentDirty = false;
      this.lastOutline = [];
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      void vscode.commands.executeCommand("setContext", "confluence-previewer.previewActive", false);
    });

    panel.webview.onDidReceiveMessage((msg) => {
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
        case "openAttachment":
          void this.handleOpenAttachment(msg.filename as string);
          break;
      }
    });

    void vscode.commands.executeCommand("setContext", "confluence-previewer.previewActive", true);
  }

  private async handleNavigate(target: string): Promise<void> {
    if (!this.currentDoc) return;
    const node = flattenOutline(this.lastOutline).find((n) => n.id === target);
    if (!node || node.sourceOffset === undefined) return;
    const pos = this.currentDoc.positionAt(node.sourceOffset);
    const editor = await vscode.window.showTextDocument(this.currentDoc);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(pos, pos);
  }

  private async handleOpenLink(href: string): Promise<void> {
    if (!href || !isAllowedExternalHref(href)) return;
    await vscode.env.openExternal(vscode.Uri.parse(href));
  }

  private async handleOpenAttachment(filename: string): Promise<void> {
    const abs = this.resolveLocalPath(filename);
    if (!abs) {
      void vscode.window.showWarningMessage(`Attachment not found next to the source file: ${filename}`);
      return;
    }
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
  }

  private async refreshNow(): Promise<void> {
    if (!this.panel || !this.currentDoc) return;
    const text = this.currentDoc.getText();
    let result;
    try {
      result = parseConfluence(text, this.parseOptions());
    } catch (e: any) {
      this.lastOutline = [];
      await this.panel.webview.postMessage({
        command: "render",
        payload: {
          title: this.currentDoc.fileName,
          html: `<div class="cf-error"><strong>Parse error:</strong><pre>${escapeHtml(
            String(e?.message ?? e),
          )}</pre></div>`,
          outline: [],
          warnings: [String(e?.message ?? e)],
          macros: [],
          dirty: false,
          uri: this.currentDoc.uri.toString(),
        },
      });
      return;
    }

    this.lastOutline = result.outline;
    await this.panel.webview.postMessage({
      command: "render",
      payload: {
        title: this.currentDoc.fileName,
        html: result.html,
        outline: result.outline,
        warnings: result.warnings,
        macros: result.macros,
        dirty: this.currentDirty,
        uri: this.currentDoc.uri.toString(),
        outlineVisible: this.config().get<boolean>("outlineVisible", true),
      },
    });
  }

  private async buildStandaloneHtml(bodyHtml: string, title: string): Promise<string> {
    const mediaRoot = path.join(this.context.extensionPath, "dist", "media");
    const [css, hljs] = await Promise.all([
      readFile(path.join(mediaRoot, "style.css"), "utf8"),
      readFile(path.join(mediaRoot, "highlight.min.js"), "utf8"),
    ]);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body class="vscode-light">
<div id="app">
  <header class="cf-header"><span class="cf-title">${escapeHtml(title)}</span></header>
  <main class="cf-main cf-standalone">
    <article class="cf-content" id="cf-content">${bodyHtml}</article>
  </main>
</div>
<script>
${hljs}
</script>
<script>
(function () {
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() { document.body.className = mq.matches ? "vscode-dark" : "vscode-light"; }
  applyTheme();
  if (mq.addEventListener) mq.addEventListener("change", applyTheme);
  if (window.hljs) { try { window.hljs.highlightAll(); } catch (e) {} }
  document.querySelectorAll("code[data-linenumbers='1']").forEach(function (code) {
    var pre = code.closest("pre");
    if (!pre) return;
    var first = parseInt(code.getAttribute("data-firstline") || "1", 10) || 1;
    var count = code.textContent.split("\\n").length;
    var nums = [];
    for (var i = 0; i < count; i++) nums.push(first + i);
    var gutter = document.createElement("pre");
    gutter.className = "cf-code-gutter";
    gutter.textContent = nums.join("\\n");
    var wrap = document.createElement("div");
    wrap.className = "cf-code-lined";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(gutter);
    wrap.appendChild(pre);
  });
})();
</script>
</body>
</html>`;
  }
}

// ----------------------------------------------------------------------

function flattenOutline(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function renderPreviewShell(
  styleUri: string,
  scriptUri: string,
  hlUri: string,
  cspSource: string,
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; img-src ${cspSource} data:; font-src ${cspSource};"/>
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
    <button class="cf-header-btn" id="cf-toggle-outline" type="button">Hide outline</button>
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