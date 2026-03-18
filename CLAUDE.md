# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A VSCode extension that formats Claude `SKILL.md` files. It enforces frontmatter schema ordering, YAML scalar styles, section spacing, list normalization, and markdown conventions. Activates for files with language ID `skill-md` or any file named `SKILL.md`.

## Commands

```bash
npm run build      # Bundle with esbuild → dist/extension.js
npm run watch      # Build in watch mode (no minification)
npm run lint       # Type-check with tsc --noEmit
npm test           # Run tests with vitest
npm run package    # Create .vsix with vsce
```

Press F5 in VSCode to launch the Extension Development Host for manual testing.

## Architecture

The extension has a clear pipeline: **parse → format frontmatter → format markdown body → reassemble**.

- `src/extension.ts` — VSCode integration layer. Registers the formatting provider for both `skill-md` and `markdown` (SKILL.md pattern), handles format-on-save, the command palette entry, status bar, and diagnostics wiring. All VSCode API usage is confined here and in `diagnostics.ts`.
- `src/formatter.ts` — Orchestrator. Uses `gray-matter` to split frontmatter from body, delegates to `frontmatter.ts` and `markdown.ts`, then reassembles with `---` fences and a trailing newline.
- `src/frontmatter.ts` — YAML formatting. Orders keys (`name` first, `description` second, rest alphabetical). Uses the `yaml` library's `Document` API to set scalar styles: `name` is always `PLAIN`, `description` uses `BLOCK_FOLDED` (`>`) when >72 chars or multiline.
- `src/markdown.ts` — Body formatting. Pure function, no VSCode dependency. Applies rules in order: strip trailing whitespace → normalize `~~~` to `` ``` `` → normalize list markers (`*`/`+` → `-`, renumber ordered lists) → collapse excessive blank lines → enforce heading spacing (2 blanks before `##`, 1 before `###`+, 1 after any heading) → trim leading/trailing blanks. All transforms skip content inside fenced code blocks.
- `src/diagnostics.ts` — Real-time editor warnings. Checks for missing `name`/`description`, short descriptions (<50 chars), body exceeding `maxBodyLines`, multiple `#` headings, and code fences without language tags.

Key design constraint: `formatter.ts`, `frontmatter.ts`, and `markdown.ts` are pure functions with no VSCode dependency — they can be tested without mocking the VSCode API.

## Testing

Tests live in `tests/` and use vitest. There are two test files:

- `tests/formatter.test.ts` — End-to-end formatting (fixture-based via `tests/fixtures/`), frontmatter ordering/scalar styles, markdown body transforms
- `tests/edge-cases.test.ts` — Boundary conditions: empty files, unicode, nested fences, tab indentation, mixed lists, idempotency stress tests

The fixture pair `tests/fixtures/messy-input.md` → `tests/fixtures/expected-output.md` is the canonical end-to-end test case.

Formatting must be **idempotent** — `formatSkillFile(formatSkillFile(x)) === formatSkillFile(x)`. Multiple tests verify this.

## Build

esbuild bundles `src/extension.ts` into a single `dist/extension.js` (CJS, node18 target). The `vscode` module is externalized. TypeScript compiles to ES2022/CommonJS with strict mode.

## Key Dependencies

- `gray-matter` — Frontmatter parsing
- `yaml` — YAML serialization with fine-grained scalar style control (the `Document`/`Scalar` API)
- `esbuild` — Bundler
- `vitest` — Test runner
