import * as vscode from "vscode";
import matter from "gray-matter";
import { isSkillFile } from "./utils";

const DIAGNOSTIC_SOURCE = "skill-format";
const DEBOUNCE_MS = 300;

export function createDiagnosticsProvider(): vscode.Disposable[] {
  const collection =
    vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);

  const disposables: vscode.Disposable[] = [collection];

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleUpdate(doc: vscode.TextDocument) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateDiagnostics(doc, collection), DEBOUNCE_MS);
  }

  disposables.push(
    vscode.workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc, collection)),
    vscode.workspace.onDidChangeTextDocument((e) => scheduleUpdate(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri))
  );

  for (const doc of vscode.workspace.textDocuments) {
    updateDiagnostics(doc, collection);
  }

  return disposables;
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
  const lines = text.split("\n");

  // Parse frontmatter
  let data: Record<string, unknown> = {};
  let frontmatterEnd = 0;

  try {
    const parsed = matter(text);
    data = parsed.data;
    // Find end of frontmatter by locating the closing --- fence
    const firstFence = text.indexOf("---");
    if (firstFence >= 0) {
      const secondFence = text.indexOf("---", firstFence + 3);
      if (secondFence >= 0) {
        // Count newlines up to the second fence
        let count = 0;
        for (let i = 0; i < secondFence; i++) {
          if (text.charCodeAt(i) === 10) count++;
        }
        frontmatterEnd = count + 1;
      }
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

  // ── Heading hierarchy + code fence checks ──
  let h1Count = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      // Check for missing language tag on opening fences (before toggling state)
      if (!inCodeBlock) {
        const hasLang = /^(\s*)```\S/.test(line);
        if (!hasLang) {
          diagnostics.push(
            makeDiag(
              i,
              "Code fence missing language tag (e.g., ```python, ```bash).",
              vscode.DiagnosticSeverity.Information
            )
          );
        }
      }
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
