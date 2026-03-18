import { Document, Scalar, stringify } from "yaml";

/** Fields that appear first, in this exact order. Everything else goes alphabetical after. */
const PRIORITY_FIELDS = ["name", "description"] as const;

export interface FrontmatterFormatOptions {
  indent: number;
  enforceBlockScalar: boolean;
}

const DEFAULTS: FrontmatterFormatOptions = {
  indent: 2,
  enforceBlockScalar: true,
};

/**
 * Formats a parsed frontmatter object into canonical YAML.
 *
 * Rules:
 * - `name` first, `description` second, rest alphabetical
 * - `description` uses YAML block scalar `>` when multiline or long
 * - `name` is always bare (unquoted)
 * - Consistent indentation
 * - No trailing spaces inside YAML
 */
export function formatFrontmatter(
  data: Record<string, unknown>,
  opts: Partial<FrontmatterFormatOptions> = {}
): string {
  const { indent, enforceBlockScalar } = { ...DEFAULTS, ...opts };

  if (Object.keys(data).length === 0) return "";

  // Build ordered key list
  const keys = orderKeys(Object.keys(data));

  // Reconstruct in order
  const ordered: Record<string, unknown> = {};
  for (const key of keys) {
    ordered[key] = data[key];
  }

  // Use yaml library's Document for fine-grained control
  const doc = new Document(ordered);

  // Walk the document to apply scalar styles
  applyScalarStyles(doc, enforceBlockScalar);

  return stringify(doc, {
    indent,
    lineWidth: 80,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
}

function orderKeys(keys: string[]): string[] {
  const prioritized: string[] = [];
  const rest: string[] = [];

  for (const pf of PRIORITY_FIELDS) {
    if (keys.includes(pf)) prioritized.push(pf);
  }

  for (const k of keys) {
    if (!PRIORITY_FIELDS.includes(k as (typeof PRIORITY_FIELDS)[number])) {
      rest.push(k);
    }
  }

  rest.sort((a, b) => a.localeCompare(b));
  return [...prioritized, ...rest];
}

function applyScalarStyles(doc: Document, enforceBlockScalar: boolean): void {
  const contents = doc.contents;
  if (!contents || !("items" in contents)) return;

  for (const item of (contents as any).items) {
    const key =
      item.key instanceof Scalar ? item.key.value : String(item.key);
    const val = item.value;

    if (!(val instanceof Scalar)) continue;

    if (key === "name") {
      // name: always plain/unquoted
      val.type = Scalar.PLAIN;
    } else if (key === "description" && typeof val.value === "string") {
      if (enforceBlockScalar && (val.value.length > 72 || val.value.includes("\n"))) {
        val.type = Scalar.BLOCK_FOLDED; // >
        // Ensure value ends with newline for clip (>) instead of strip (>-)
        if (!val.value.endsWith("\n")) {
          val.value = val.value + "\n";
        }
      } else {
        val.type = Scalar.PLAIN;
      }
    }
  }
}
