import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { formatSkillFile } from "../src/formatter";
import { formatFrontmatter } from "../src/frontmatter";
import { formatMarkdownBody } from "../src/markdown";

const FIXTURES = join(__dirname, "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

// ── End-to-end ──────────────────────────────────────────────

describe("formatSkillFile", () => {
  it("formats a messy SKILL.md into canonical form", () => {
    const input = readFixture("messy-input.md");
    const expected = readFixture("expected-output.md");
    const result = formatSkillFile(input);
    expect(result).toBe(expected);
  });

  it("is idempotent — formatting twice yields the same result", () => {
    const input = readFixture("messy-input.md");
    const first = formatSkillFile(input);
    const second = formatSkillFile(first);
    expect(second).toBe(first);
  });

  it("handles empty frontmatter gracefully", () => {
    const input = "---\n---\n\n# Title\n\nBody text.\n";
    const result = formatSkillFile(input);
    expect(result).toContain("# Title");
    expect(result).toContain("Body text.");
    expect(result.endsWith("\n")).toBe(true);
  });

  it("handles file with no frontmatter", () => {
    const input = "# Just a heading\n\nSome body.\n";
    const result = formatSkillFile(input);
    expect(result).toContain("# Just a heading");
    expect(result.endsWith("\n")).toBe(true);
  });
});

// ── Frontmatter ─────────────────────────────────────────────

describe("formatFrontmatter", () => {
  it("orders name first, description second, rest alphabetical", () => {
    const data = {
      license: "MIT",
      description: "A skill.",
      name: "test-skill",
      compatibility: "all",
    };
    const result = formatFrontmatter(data);
    const lines = result.split("\n");
    expect(lines[0]).toMatch(/^name:/);
    expect(lines[1]).toMatch(/^description:/);
    // compatibility before license
    expect(result.indexOf("compatibility")).toBeLessThan(
      result.indexOf("license")
    );
  });

  it("uses block scalar for long descriptions", () => {
    const data = {
      name: "test",
      description:
        "This is a very long description that should trigger the block scalar style because it exceeds the threshold.",
    };
    const result = formatFrontmatter(data, { indent: 2, enforceBlockScalar: true });
    expect(result).toContain("description: >");
  });

  it("keeps short descriptions plain", () => {
    const data = {
      name: "test",
      description: "Short.",
    };
    const result = formatFrontmatter(data, { indent: 2, enforceBlockScalar: true });
    expect(result).toContain("description: Short.");
    expect(result).not.toContain(">");
  });

  it("returns empty string for empty data", () => {
    expect(formatFrontmatter({})).toBe("");
  });
});

// ── Markdown body ───────────────────────────────────────────

describe("formatMarkdownBody", () => {
  it("strips trailing whitespace", () => {
    const result = formatMarkdownBody("hello   \nworld  \n");
    expect(result).toBe("hello\nworld");
  });

  it("normalizes unordered list markers to -", () => {
    const input = "* one\n+ two\n- three";
    const result = formatMarkdownBody(input);
    expect(result).toBe("- one\n- two\n- three");
  });

  it("renumbers ordered lists sequentially", () => {
    const input = "1) first\n3) second\n2) third";
    const result = formatMarkdownBody(input);
    expect(result).toContain("1. first");
    expect(result).toContain("2. second");
    expect(result).toContain("3. third");
  });

  it("normalizes ~~~ fences to ```", () => {
    const input = "~~~python\ncode()\n~~~";
    const result = formatMarkdownBody(input);
    expect(result).toContain("```python");
    expect(result).not.toContain("~~~");
  });

  it("adds two blank lines before ## headings", () => {
    const input = "Paragraph.\n## Section";
    const result = formatMarkdownBody(input);
    const lines = result.split("\n");
    const headingIdx = lines.findIndex((l) => l.startsWith("## "));
    expect(lines[headingIdx - 1]).toBe("");
    expect(lines[headingIdx - 2]).toBe("");
    expect(headingIdx >= 2).toBe(true);
  });

  it("adds one blank line before ### headings", () => {
    const input = "Paragraph.\n### Subsection";
    const result = formatMarkdownBody(input);
    const lines = result.split("\n");
    const headingIdx = lines.findIndex((l) => l.startsWith("### "));
    expect(lines[headingIdx - 1]).toBe("");
    // Should NOT have two blank lines
    if (headingIdx >= 2) {
      expect(lines[headingIdx - 2]).not.toBe("");
    }
  });

  it("adds one blank line after headings", () => {
    const input = "## Section\nContent right after.";
    const result = formatMarkdownBody(input);
    const lines = result.split("\n");
    const headingIdx = lines.findIndex((l) => l.startsWith("## "));
    expect(lines[headingIdx + 1]).toBe("");
    expect(lines[headingIdx + 2]).toBe("Content right after.");
  });

  it("collapses 3+ blank lines to 2", () => {
    const input = "A\n\n\n\n\nB";
    const result = formatMarkdownBody(input);
    expect(result).not.toContain("\n\n\n");
  });

  it("does not modify content inside code blocks", () => {
    const input = "```python\n* not a list\n  weird   spacing   \n```";
    const result = formatMarkdownBody(input);
    expect(result).toContain("* not a list");
    expect(result).toContain("  weird   spacing");
  });
});
