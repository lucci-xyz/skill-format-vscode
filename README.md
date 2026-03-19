# Skill Format

Simple formatter for Claude `SKILL.md` files.

Claude skills have a specific anatomy - YAML frontmatter schema, progressive disclosure tiers, directory conventions - but nothing enforces it. Skill Format does.

## What it enforces

- **Frontmatter ordering** - `name` first, `description` second, rest alphabetical
- **YAML style** - Long descriptions use block scalar (`>`). Names stay bare. 2-space indent
- **Section spacing** - Two blank lines before `##` headings. One before `###`. One after any heading
- **Lists** - Unordered normalized to `-`. Ordered auto-numbered `1.`, `2.`, `3.`
- **Code fences** - Triple backtick only, tilde fences converted
- **Whitespace** - Trailing spaces stripped. Final newline enforced. Excess blank lines collapsed
- **Code blocks** - Content inside fences is never touched

## Diagnostics

Real-time warnings in the editor:

| Severity | Condition |
|----------|-----------|
| Error | Missing `name` or `description` in frontmatter |
| Warning | Description under 50 chars - skills need trigger phrases |
| Warning | Body exceeds 500 lines - use reference files |
| Warning | Multiple `#` top-level headings |
| Info | Code fence without language tag |

## Snippets

Type these in any `SKILL.md` file:

| Prefix | What it does |
|--------|-------------|
| `skill:init` | Scaffold a complete SKILL.md with frontmatter, title, and sections |
| `skill:section` | Add a `##` section with correct spacing |
| `skill:sub` | Add a `###` subsection with correct spacing |
| `skill:ref` | Add a reference file pointer |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `skillFormat.formatOnSave` | `true` | Format SKILL.md files on save |
| `skillFormat.indentSize` | `2` | YAML and list indentation |
| `skillFormat.maxBodyLines` | `500` | Warn above this line count |
| `skillFormat.enforceDescriptionBlockScalar` | `true` | Force `>` style for long descriptions |

## Install

**Marketplace:** Search "Skill Format" in the VSCode extensions panel.

**Manual:** Download the `.vsix` from [Releases](https://github.com/lucci-xyz/skill-format-vscode/releases), then:
```bash
code --install-extension skill-format-0.1.0.vsix
```

## Usage

Open a `SKILL.md` file. Save. Done.

Or: `Ctrl+Shift+P` → `Skill Format: Format SKILL.md`

The status bar shows **Skill Format** when a SKILL.md file is active - click it to format.

## Development

```bash
git clone https://github.com/lucci-xyz/skill-format-vscode.git
cd skill-format-vscode
npm install
npm run build
npm test
```

Press `F5` in VSCode to launch the extension in a development host.

## License

MIT - [Lucci](https://github.com/lucci-xyz)
