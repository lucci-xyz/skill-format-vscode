import matter from "gray-matter";
import { formatFrontmatter, FrontmatterFormatOptions } from "./frontmatter";
import { formatMarkdownBody, MarkdownFormatOptions } from "./markdown";

export interface SkillFormatOptions {
  indent: number;
  enforceBlockScalar: boolean;
  maxLineWidth: number;
}

const DEFAULTS: SkillFormatOptions = {
  indent: 2,
  enforceBlockScalar: true,
  maxLineWidth: 0,
};

/**
 * Formats an entire SKILL.md file.
 *
 * Structure:
 * ```
 * ---
 * <formatted frontmatter>
 * ---
 *
 * <formatted markdown body>
 * ```
 */
export function formatSkillFile(
  input: string,
  opts: Partial<SkillFormatOptions> = {}
): string {
  const options = { ...DEFAULTS, ...opts };

  // Parse frontmatter
  const { data, content } = matter(input);

  // Format frontmatter
  const fmOpts: Partial<FrontmatterFormatOptions> = {
    indent: options.indent,
    enforceBlockScalar: options.enforceBlockScalar,
  };
  const formattedFrontmatter = formatFrontmatter(data, fmOpts);

  // Format body
  const mdOpts: Partial<MarkdownFormatOptions> = {
    indent: options.indent,
    maxLineWidth: options.maxLineWidth,
  };
  const formattedBody = formatMarkdownBody(content, mdOpts);

  // Assemble
  const parts: string[] = [];

  if (formattedFrontmatter) {
    parts.push("---");
    parts.push(formattedFrontmatter);
    parts.push("---");
  }

  if (formattedBody) {
    parts.push(""); // blank line after frontmatter fence
    parts.push(formattedBody);
  }

  return parts.join("\n") + "\n";
}
