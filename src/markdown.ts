export interface MarkdownFormatOptions {
  indent: number;
}

const DEFAULTS: MarkdownFormatOptions = {
  indent: 2,
};

/**
 * Formats the markdown body of a SKILL.md file.
 *
 * Rules enforced:
 * 1. Exactly one blank line between paragraphs/blocks
 * 2. Two blank lines before ## headings (major sections)
 * 3. One blank line before ### and deeper headings
 * 4. One blank line after any heading
 * 5. Single # heading allowed only once (title)
 * 6. Trailing whitespace stripped on every line
 * 7. Unordered lists normalized to `-`
 * 8. Ordered lists normalized to `1.` (auto-increment)
 * 9. Code fences use triple backtick, never tildes
 * 10. Final newline always present, no trailing blank lines
 */
export function formatMarkdownBody(
  body: string,
  opts: Partial<MarkdownFormatOptions> = {}
): string {
  const { indent } = { ...DEFAULTS, ...opts };

  let lines = body.split("\n");

  // Strip trailing whitespace on every line
  lines = lines.map((l) => l.trimEnd());

  // Normalize code fences: ~~~ → ```
  lines = normalizeFences(lines);

  // Normalize list markers
  lines = normalizeLists(lines, indent);

  // Collapse runs of 2+ blank lines to 1 (section spacing will add precise blanks)
  lines = collapseExcessiveBlanks(lines);

  // Normalize section spacing (adds exact blank lines needed around headings)
  lines = normalizeSectionSpacing(lines);

  // Trim leading blank lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  // Trim trailing blank lines, ensure single final newline
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}

// ── Fences ──────────────────────────────────────────────────

function normalizeFences(lines: string[]): string[] {
  return lines.map((line) => {
    // Replace ~~~ fence openers/closers with ```
    const fenceMatch = line.match(/^(\s*)~~~(\S*)$/);
    if (fenceMatch) {
      return `${fenceMatch[1]}\`\`\`${fenceMatch[2]}`;
    }
    return line;
  });
}

// ── Lists ───────────────────────────────────────────────────

function normalizeLists(lines: string[], indent: number): string[] {
  const result: string[] = [];
  const orderedCounters: number[] = []; // stack for nested ordered lists
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks — don't touch anything inside them
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Unordered: *, +, - (with any whitespace) → `- ` (single space)
    const ulMatch = line.match(/^(\s*)[*+-][\t ]+(.*)$/);
    if (ulMatch) {
      const depth = normalizeIndent(ulMatch[1], indent);
      result.push(`${depth}- ${ulMatch[2]}`);
      continue;
    }

    // Ordered: normalize numbering
    const olMatch = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (olMatch) {
      const rawIndent = olMatch[1];
      const depth = normalizeIndent(rawIndent, indent);
      const level = depth.length / indent;

      // Ensure counter stack is deep enough
      while (orderedCounters.length <= level) orderedCounters.push(0);
      orderedCounters[level]++;

      // Reset deeper counters
      for (let j = level + 1; j < orderedCounters.length; j++) {
        orderedCounters[j] = 0;
      }

      result.push(`${depth}${orderedCounters[level]}. ${olMatch[2]}`);
      continue;
    }

    // Not a list item — reset ordered counters if blank line
    if (line.trim() === "") {
      orderedCounters.fill(0);
    }

    result.push(line);
  }

  return result;
}

function normalizeIndent(raw: string, indentSize: number): string {
  // Convert tabs to spaces, then round to nearest indent level
  const spaces = raw.replace(/\t/g, " ".repeat(indentSize));
  const level = Math.round(spaces.length / indentSize);
  return " ".repeat(level * indentSize);
}

// ── Section spacing ─────────────────────────────────────────

function normalizeSectionSpacing(lines: string[]): string[] {
  const result: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks — don't touch anything inside them
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+/);

    if (headingMatch) {
      const level = headingMatch[1].length;

      // Remove existing trailing blanks
      while (result.length > 0 && result[result.length - 1].trim() === "") {
        result.pop();
      }

      // Add spacing before heading (only if not first line)
      if (result.length > 0) {
        if (level <= 2) {
          // ## and # get two blank lines before
          result.push("", "");
        } else {
          // ### and deeper get one blank line before
          result.push("");
        }
      }

      result.push(line);

      // Ensure one blank line after heading (peek ahead)
      const next = i + 1 < lines.length ? lines[i + 1] : null;
      if (next !== null && next.trim() !== "") {
        result.push("");
      }

      continue;
    }

    result.push(line);
  }

  return result;
}

// ── Blank line collapse ─────────────────────────────────────

function collapseExcessiveBlanks(lines: string[]): string[] {
  const result: string[] = [];
  let consecutiveBlanks = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      consecutiveBlanks++;
      if (consecutiveBlanks <= 1) {
        result.push(line);
      }
    } else {
      consecutiveBlanks = 0;
      result.push(line);
    }
  }

  return result;
}
