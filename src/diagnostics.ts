import * as vscode from "vscode";
import matter from "gray-matter";

const DIAGNOSTIC_SOURCE = "skill-format";

export function createDiagnosticsProvider(): vscode.Disposable[] {
  const collection =
    vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);

  const disposables: vscode.Disposable[] = [collection];

  // Run on open and change
  disposables.push(
    vscode.workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc, collection)),
    vscode.workspace.onDidChangeTextDocument((e) => updateDiagnostics(e.document, collection)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri))
  );

  // Run on all already-open documents
  for (const doc of vscode.workspace.textDocuments) {
    updateDiagnostics(doc, collection);
  }

  return disposables;
}

function isSkillFile(doc: vscode.TextDocument): boolean {
  return (
    doc.languageId === "skill-md" ||
    doc.fileName.endsWith("SKILL.md")
  );
}

function updateDiagnostics(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  if (!isSkillFile(doc)) {
    collection.delete(doc.uri);
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];
  const text = doc.getText();

  // Parse frontmatter
  let data: Record<string, unknown> = {};
  let frontmatterEnd = 0;

  try {
    const parsed = matter(text);
    data = parsed.data;
    // Find end of frontmatter in the document
    const secondFence = text.indexOf("---", text.indexOf("---") + 3);
    if (secondFence >= 0) {
      frontmatterEnd = text.substring(0, secondFence).split("\n").length;
    }
  } catch {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 3),
        "Invalid YAML frontmatter.",
        vscode.DiagnosticSeverity.Error
      )
    );
    collection.set(doc.uri, diagnostics);
    return;
  }

  // ── Required fields ──
  if (!data.name) {
    diagnostics.push(
      makeDiag(0, "Missing required field: `name`.", vscode.DiagnosticSeverity.Error)
    );
  }

  if (!data.description) {
    diagnostics.push(
      makeDiag(0, "Missing required field: `description`.", vscode.DiagnosticSeverity.Error)
    );
  }

  // ── Description quality ──
  if (typeof data.description === "string") {
    const desc = data.description;

    if (desc.length < 50) {
      diagnostics.push(
        makeDiag(
          1,
          `Description is short (${desc.length} chars). Aim for ≥100 chars with specific trigger phrases.`,
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
  }

  // ── Body length ──
  const config = vscode.workspace.getConfiguration("skillFormat");
  const maxLines = config.get<number>("maxBodyLines", 500);
  const bodyLines = doc.lineCount - frontmatterEnd;

  if (bodyLines > maxLines) {
    diagnostics.push(
      makeDiag(
        frontmatterEnd,
        `Body is ${bodyLines} lines (recommended max: ${maxLines}). Consider moving content to reference files.`,
        vscode.DiagnosticSeverity.Warning
      )
    );
  }

  // ── Heading hierarchy ──
  const lines = text.split("\n");
  let h1Count = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const headingMatch = line.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      if (headingMatch[1].length === 1) {
        h1Count++;
        if (h1Count > 1) {
          diagnostics.push(
            makeDiag(
              i,
              "Multiple `#` headings. Only one top-level heading is allowed.",
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }

    // Code fence without language tag
    const fenceOpen = line.match(/^(\s*)```(\s*)$/);
    if (fenceOpen && !inCodeBlock) {
      // This is an opening fence with no language — check it's not a closing fence
      // by looking if we just entered a code block
      const prevCodeState = isInCodeBlock(lines, i);
      if (!prevCodeState) {
        diagnostics.push(
          makeDiag(
            i,
            "Code fence missing language tag (e.g., ```python, ```bash).",
            vscode.DiagnosticSeverity.Information
          )
        );
      }
    }
  }

  collection.set(doc.uri, diagnostics);
}

function makeDiag(
  line: number,
  message: string,
  severity: vscode.DiagnosticSeverity
): vscode.Diagnostic {
  const diag = new vscode.Diagnostic(
    new vscode.Range(line, 0, line, 1000),
    message,
    severity
  );
  diag.source = DIAGNOSTIC_SOURCE;
  return diag;
}

/**
 * Checks if line `targetLine` is inside a code block by counting fences before it.
 */
function isInCodeBlock(lines: string[], targetLine: number): boolean {
  let inside = false;
  for (let i = 0; i < targetLine; i++) {
    if (lines[i].trimStart().startsWith("```")) {
      inside = !inside;
    }
  }
  return inside;
}
