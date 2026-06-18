/**
 * Confluence Preview — VS Code extension entry point.
 */

import * as vscode from "vscode";
import { parseConfluence } from "./parser";
import { PreviewPanel } from "./previewPanel";

export function activate(context: vscode.ExtensionContext) {
  const previewPanel = new PreviewPanel(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "confluence-preview.openPreview",
      () => previewPanel.openForActiveEditor(),
    ),
    vscode.commands.registerCommand(
      "confluence-preview.refresh",
      () => previewPanel.refresh(),
    ),
    vscode.commands.registerCommand(
      "confluence-preview.copyHtml",
      () => previewPanel.copyRenderedHtml(),
    ),
    vscode.commands.registerCommand(
      "confluence-preview.exportMarkdown",
      () => previewPanel.exportMarkdown(),
    ),
  );

  // Keep preview in sync with the editor: refresh on save or text change
  // (debounced) when the preview is showing this same document.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      previewPanel.onDocumentChanged(doc);
    }),
  );

  context.subscriptions.push(
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
}

export function deactivate() {}