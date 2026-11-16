/**
 * Confluence Preview — VS Code extension entry point.
 */

import * as vscode from "vscode";
import { PreviewPanel } from "./previewPanel";

export function activate(context: vscode.ExtensionContext) {
  const previewPanel = new PreviewPanel(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "confluence-previewer.openPreview",
      () => previewPanel.openForActiveEditor(),
    ),
    vscode.commands.registerCommand(
      "confluence-previewer.refresh",
      () => previewPanel.refresh(),
    ),
    vscode.commands.registerCommand(
      "confluence-previewer.copyHtml",
      () => previewPanel.copyRenderedHtml(),
    ),
    vscode.commands.registerCommand(
      "confluence-previewer.exportMarkdown",
      () => previewPanel.exportMarkdown(),
    ),
    vscode.commands.registerCommand(
      "confluence-previewer.exportHtml",
      () => previewPanel.exportStandaloneHtml(),
    ),
  );

  // Restore the preview panel after a window reload.
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer("confluencePreview", {
      async deserializeWebviewPanel(panel, state) {
        await previewPanel.restore(panel, state);
      },
    }),
  );

  // Keep preview in sync with the editor: refresh on save or text change
  // (debounced) when the preview is showing this same document.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      previewPanel.onDocumentChanged(doc);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      previewPanel.onDocumentChanged(e.document, /* debounce */ true);
    }),
  );

  // Re-render when the active editor changes (user opens a different file).
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) previewPanel.onDocumentChanged(editor.document);
    }),
  );

  // Editor scroll → preview scroll sync.
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      previewPanel.onEditorScroll(e.textEditor);
    }),
  );

  // Menu/keybinding gating for the optional HTML fallback.
  const syncHtmlContext = () => {
    const enabled = vscode.workspace
      .getConfiguration("confluence-previewer")
      .get<boolean>("enableForHtml", false);
    void vscode.commands.executeCommand(
      "setContext",
      "confluence-previewer.enableForHtml",
      enabled,
    );
  };
  syncHtmlContext();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("confluence-previewer")) syncHtmlContext();
    }),
  );
}

export function deactivate() {}