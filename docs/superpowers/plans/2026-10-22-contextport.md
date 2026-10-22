# ContextPort v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real, tested local-only OSS migration CLI with no API keys or private data.

**Architecture:** Node.js 22+ TypeScript ESM with native test runner. Pure in-memory parsing/redaction/validation core; separate file I/O boundary. Zero production dependencies; no network use.

**Tech Stack:** TypeScript, Node.js `node:test`, optional TypeScript typechecking, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-22-contextport-design.md`

## Global Constraints

- No real chat, project, account or API data; use synthetic test fixtures only.
- Do not write unredacted record content to disk, logs, or error messages.
- Read only paths explicitly supplied by the user; preserve source input; limit sizes; refuse overwrites by default.
- RED → GREEN for each functionality group, full suite per task, then commit.

## Review Focus

- Secret patterns and privacy escape paths; malformed data and warning leaks.
- Data loss due to unknown adapter shapes or cross-project deduplication.
- Atomicity, overwrite refusal, symlinks/same-path hazards, failure cleanup.
- CLI usage cross-platform; realistic product claims and provenance sanitization.

## Task 1: Bootstrap and portable schema/core

**Produces:** `src/core/records.ts`: `PortableRecord`, `PortableDocument`, `normalizeRecord`, `deduplicate`, `validateDocument`.

- [ ] Add `package.json`, `tsconfig.json`, `.gitignore`; use Node native TS type stripping and `node:test`.
- [ ] RED: `tests/core.test.ts` must test whitespace normalization, same-project stable dedup, cross-project separation, invalid schema/IDs/duplicate IDs, valid document.
- [ ] Run `npm test -- tests/core.test.ts`. Expected: fail because core module is missing.
- [ ] GREEN: implement typed schema and deduplication, run test. Expected: all core tests pass.
- [ ] Run `npm test`. Expected: green. Commit `feat: add portable records core`.

## Task 2: Privacy redaction

**Consumes:** `PortableRecord` from Task 1. **Produces:** `src/core/redact.ts`: `redactText`, `sanitizeRecords` and category-only counts.

- [ ] RED: `tests/redaction.test.ts` with fabricated OpenAI/GitHub/AWS-style keys, Bearer credentials, `.env` assignments, private key, email/phone opt-in, no raw leaks.
- [ ] Run `npm test -- tests/redaction.test.ts`. Expected: missing module failure.
- [ ] GREEN: implement best-effort pattern redaction including multiline keys and count categories; maintain deterministic replacements.
- [ ] Run `npm test`. Expected: all pass. Commit `feat: sanitize secrets before export`.

## Task 3: Source adapters

**Consumes:** normalized records from Task 1. **Produces:** `src/adapters/index.ts` `parseSource(sourceText, format)` returning records, skipped count, non-sensitive warnings.

- [ ] RED: `tests/adapters.test.ts` for Markdown note, generic JSONL, Codex message/response extracts, Claude user/assistant messages, unsupported/malformed lines, private identifier sanitization and per-format counts.
- [ ] Run `npm test -- tests/adapters.test.ts`. Expected: missing module failure.
- [ ] GREEN: implement four explicit adapters, conservative interpretation, source positions, no raw paths/IDs in provenance, no unsupported record misrepresentation.
- [ ] Run `npm test`. Expected: all pass. Commit `feat: parse four local input formats`.

## Task 4: File CLI and verification

**Consumes:** all prior core/adapters. **Produces:** `src/cli/main.ts`, `src/output/files.ts`, `src/cli/run.ts` commands `inspect`, `convert`, `verify`.

- [ ] RED: `tests/cli.test.ts` integration spawning CLI with temp files: inspect counts no raw snippets; convert JSON/Markdown; verify valid/tampered; overwrite denial; same input/output; preserve input bytes; no artifacts on failure; invalid command safe exit.
- [ ] Run `npm test -- tests/cli.test.ts`. Expected: missing CLI implementation failure.
- [ ] GREEN: implement option parser, size cap, staged redacted serialization, validation, safe temporary write/cleanup/rename, output-only diagnostics.
- [ ] Run `npm test`. Expected: all pass. Commit `feat: ship local inspect convert verify CLI`.

## Task 5: Documentation and release-quality checks

- [ ] Add CI matrix (Node 22 and 24, Windows/macOS/Linux), README quickstart/usage, synthetic examples, CONTRIBUTING, SECURITY, CHANGELOG, LICENSE.
- [ ] Add repository safety checks for secret strings, lockfile/dependency expectations, no private assets, and executability.
- [ ] Run `npm test` and `npm run check`; expected all pass. Smoke-test CLI with fabricated example, inspect report.
- [ ] Commit `docs: prepare ContextPort for public release`.
- [ ] Whole-branch review focusing Review Focus, repair important defects with RED/GREEN regression tests, reverify.
- [ ] Publish only to explicitly authorized public GitHub repo, if publishing capability is available. Release/tag only after tests and audit.
