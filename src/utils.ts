import * as vscode from "vscode";

export function isSkillFile(doc: vscode.TextDocument): boolean {
  return (
    doc.languageId === "skill-md" || doc.fileName.endsWith("SKILL.md")
  );
}
