import * as vscode from "vscode";
import { formatSkillFile } from "./formatter";
import { createDiagnosticsProvider } from "./diagnostics";
import { isSkillFile } from "./utils";

export function activate(context: vscode.ExtensionContext): void {
  // Register as a document formatter for skill-md language
  const skillFormatter = vscode.languages.registerDocumentFormattingEditProvider(
    { language: "skill-md" },
    new SkillFormattingProvider()
  );

  // Also register for plain markdown files named SKILL.md
  const mdFormatter = vscode.languages.registerDocumentFormattingEditProvider(
    { language: "markdown", pattern: "**/SKILL.md" },
    new SkillFormattingProvider()
  );

  // Register diagnostics
  const diagnosticDisposables = createDiagnosticsProvider();

  // Status bar indicator
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = "$(symbol-property) Skill Format";
  statusBar.tooltip = "Skill Format is active for this file";
  statusBar.command = "skillFormat.format";

  function updateStatusBar() {
    const editor = vscode.window.activeTextEditor;
    if (editor && isSkillFile(editor.document)) {
      statusBar.show();
    } else {
      statusBar.hide();
    }
  }

  updateStatusBar();
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(updateStatusBar);

  // Format on save (if enabled)
  const onSave = vscode.workspace.onWillSaveTextDocument((event) => {
    const config = vscode.workspace.getConfiguration("skillFormat");
    if (!config.get<boolean>("formatOnSave", true)) return;
    if (!isSkillFile(event.document)) return;

    event.waitUntil(Promise.resolve(formatDocumentSync(event.document)));
  });

  // Register command
  const formatCmd = vscode.commands.registerCommand(
    "skillFormat.format",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      if (!isSkillFile(editor.document)) {
        vscode.window.showWarningMessage(
          "Skill Format: This file is not a SKILL.md file."
        );
        return;
      }

      const edits = formatDocumentSync(editor.document);
      if (edits.length > 0) {
        const edit = new vscode.WorkspaceEdit();
        for (const e of edits) {
          edit.replace(editor.document.uri, e.range, e.newText);
        }
        await vscode.workspace.applyEdit(edit);
      }
    }
  );

  context.subscriptions.push(
    skillFormatter,
    mdFormatter,
    onSave,
    formatCmd,
    statusBar,
    onEditorChange,
    ...diagnosticDisposables
  );

  console.log("Skill Format activated.");
}

export function deactivate(): void {}

// ── Helpers ──────────────────────────────────────────────────

class SkillFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.TextEdit[] {
    return formatDocumentSync(document);
  }
}

function formatDocumentSync(doc: vscode.TextDocument): vscode.TextEdit[] {
  const config = vscode.workspace.getConfiguration("skillFormat");
  const indent = config.get<number>("indentSize", 2);
  const enforceBlockScalar = config.get<boolean>(
    "enforceDescriptionBlockScalar",
    true
  );

  const original = doc.getText();

  try {
    const formatted = formatSkillFile(original, {
      indent,
      enforceBlockScalar,
    });

    if (formatted === original) return [];

    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(original.length)
    );

    return [vscode.TextEdit.replace(fullRange, formatted)];
  } catch (err) {
    console.error("Skill Format error:", err);
    return [];
  }
}
