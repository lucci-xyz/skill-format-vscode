import { describe, it, expect } from "vitest";
import { formatSkillFile } from "../src/formatter";
import { formatFrontmatter } from "../src/frontmatter";
import { formatMarkdownBody } from "../src/markdown";

// ── Edge cases: formatSkillFile ─────────────────────────────

describe("formatSkillFile edge cases", () => {
  it("handles frontmatter-only file (no body)", () => {
    const input = "---\nname: empty\ndescription: No body.\n---\n";
    const result = formatSkillFile(input);
    expect(result).toBe("---\nname: empty\ndescription: No body.\n---\n");
  });

  it("handles completely empty file", () => {
    const input = "";
    const result = formatSkillFile(input);
    expect(result.trim()).toBe("");
  });

  it("preserves unicode in frontmatter and body", () => {
    const input = '---\nname: café-helper\ndescription: Помогает с кофе ☕\n---\n\n# Café Helper\n\nМы любим кофе.\n';
    const result = formatSkillFile(input);
    expect(result).toContain("café-helper");
    expect(result).toContain("Помогает с кофе ☕");
    expect(result).toContain("Мы любим кофе.");
  });

  it("handles frontmatter with only name", () => {
    const input = "---\nname: minimal\n---\n\n# Minimal\n\nJust a name.\n";
    const result = formatSkillFile(input);
    expect(result).toContain("name: minimal");
    expect(result).toContain("# Minimal");
  });

  it("handles multiline description already in block scalar", () => {
    const input =
      "---\nname: test\ndescription: >\n  This is already a block scalar\n  that spans multiple lines.\n---\n\n# Test\n\nBody.\n";
    const result = formatSkillFile(input);
    // Should remain valid and not double-wrap
    expect(result).toContain("name: test");
    expect(result).toContain("# Test");
  });
});

// ── Edge cases: formatFrontmatter ───────────────────────────

describe("formatFrontmatter edge cases", () => {
  it("handles description with single quotes", () => {
    const data = { name: "test", description: "It's a skill that can't fail." };
    const result = formatFrontmatter(data);
    expect(result).toContain("It's a skill that can't fail.");
  });

  it("handles description with colons", () => {
    const data = {
      name: "test",
      description: "Trigger: when the user says deploy",
    };
    const result = formatFrontmatter(data);
    expect(result).toContain("Trigger");
    expect(result).toContain("deploy");
  });

  it("handles numeric values", () => {
    const data = { name: "test", description: "A skill.", version: 2 };
    const result = formatFrontmatter(data);
    expect(result).toContain("version: 2");
  });

  it("handles boolean values", () => {
    const data = {
      name: "test",
      description: "A skill.",
      experimental: true,
    };
    const result = formatFrontmatter(data);
    expect(result).toContain("experimental: true");
  });

  it("handles array values", () => {
    const data = {
      name: "test",
      description: "A skill.",
      tags: ["ai", "tools"],
    };
    const result = formatFrontmatter(data);
    expect(result).toContain("tags");
  });
});

// ── Edge cases: formatMarkdownBody ──────────────────────────

describe("formatMarkdownBody edge cases", () => {
  it("does NOT protect 4-space indented code blocks (use fences instead)", () => {
    // SKILL.md files should use fenced code blocks. The formatter
    // intentionally normalizes list markers even inside 4-space blocks.
    const input = "Some text\n\n    code block line 1\n    * not a list\n    code block line 3\n\nMore text";
    const result = formatMarkdownBody(input);
    expect(result).toContain("    code block line 1");
    // * gets normalized to - because we don't protect indented blocks
    expect(result).toContain("    - not a list");
  });

  it("handles nested code fences (triple inside quadruple)", () => {
    const input = "````markdown\n```python\nprint('hi')\n```\n````";
    const result = formatMarkdownBody(input);
    // Should not break the nesting
    expect(result).toContain("```python");
    expect(result).toContain("print('hi')");
  });

  it("handles empty code block", () => {
    const input = "```python\n```";
    const result = formatMarkdownBody(input);
    expect(result).toBe("```python\n```");
  });

  it("handles heading with no text after it at EOF", () => {
    const input = "## Section";
    const result = formatMarkdownBody(input);
    expect(result).toBe("## Section");
  });

  it("handles deeply nested ordered lists", () => {
    const input = "1. first\n  1. nested\n    1. deep";
    const result = formatMarkdownBody(input);
    expect(result).toContain("1. first");
    expect(result).toContain("1. nested");
    expect(result).toContain("1. deep");
  });

  it("handles mixed list types adjacent", () => {
    const input = "- unordered\n1. ordered\n- unordered again";
    const result = formatMarkdownBody(input);
    expect(result).toContain("- unordered");
    expect(result).toContain("1. ordered");
    expect(result).toContain("- unordered again");
  });

  it("handles horizontal rules without eating them", () => {
    const input = "Above\n\n---\n\nBelow";
    const result = formatMarkdownBody(input);
    expect(result).toContain("---");
    expect(result).toContain("Above");
    expect(result).toContain("Below");
  });

  it("handles blockquotes", () => {
    const input = "> This is a quote\n>\n> With multiple lines";
    const result = formatMarkdownBody(input);
    expect(result).toContain("> This is a quote");
    expect(result).toContain("> With multiple lines");
  });

  it("handles links and inline code untouched", () => {
    const input =
      "See [this link](https://example.com) and use `inline code` here.";
    const result = formatMarkdownBody(input);
    expect(result).toBe(input);
  });

  it("does not mangle bold/italic markers as list items", () => {
    const input = "This is **bold** and *italic* text.";
    const result = formatMarkdownBody(input);
    expect(result).toBe("This is **bold** and *italic* text.");
  });

  it("handles tab indentation in lists", () => {
    const input = "-\tfirst\n-\tsecond";
    const result = formatMarkdownBody(input);
    expect(result).toContain("- first");
    expect(result).toContain("- second");
  });
});

// ── Idempotency stress test ─────────────────────────────────

describe("idempotency", () => {
  const cases = [
    "---\nname: a\ndescription: b\n---\n\n# Title\n\nBody.\n",
    "---\ndescription: A very long description that should trigger block scalar formatting because it is over seventy-two characters long.\nname: test\n---\n\n## Section One\n\n- item\n\n## Section Two\n\n1. first\n2. second\n",
    "---\nname: empty-body\ndescription: Short.\n---\n",
    "# No frontmatter\n\nJust markdown.\n\n## Section\n\n- a\n- b\n",
  ];

  cases.forEach((input, i) => {
    it(`case ${i + 1}: formatting is stable after two passes`, () => {
      const first = formatSkillFile(input);
      const second = formatSkillFile(first);
      expect(second).toBe(first);
    });
  });
});
