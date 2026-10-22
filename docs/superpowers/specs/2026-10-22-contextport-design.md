# ContextPort OSS — Design Specification

**Status:** Proposed for user review  
**Date:** 2026-10-22  
**Project owner:** Abdullah Yiğit Özen (`yyigit00707-source`)

## 1. Goal

ContextPort is a local-first, open-source CLI that converts explicitly selected AI coding-assistant context records into a portable, reviewable format while redacting secrets. It helps developers migrate or back up project decisions and lessons between Codex, Claude Code, and other tools without exposing private sessions to a cloud service.

Success for v0.1 means a stranger can install it, inspect a small supported input, export a sanitized neutral JSON/Markdown document, and validate the result on Windows, Linux, or macOS. GitHub stars, adoption, and acceptance to OpenAI's OSS program are **not** promised.

## 2. Version 0.1 scope

### Included

- TypeScript CLI on Node.js 22+ with `inspect`, `convert`, and `verify` commands.
- Input adapters for Markdown notes, generic JSONL, and user-selected local Codex and Claude Code JSONL exports. Adapters explicitly skip and report unknown record types rather than pretending to understand them.
- Versioned neutral JSON schema: `id`, `source`, `project`, `kind`, `content`, optional `createdAt`, and sanitized provenance. Optional human-readable Markdown output.
- Secret redaction by default for common API tokens, credentials, private keys, and `.env` assignments; optional email/phone redaction.
- Deduplication within project boundaries; safe preview counts and warnings; validation of exported records.
- No automatic directory scanning, no telemetry, no API keys, no network calls, and no modification of original input files.
- English documentation, synthetic example files, MIT license, GitHub Actions CI, and cross-platform tests.

### Deferred

No account login, ChatGPT memory scraping, automatic sync, web dashboard, background daemon, hosted database, Qdrant/Mem0 integration, embedding models, or AI summarization in v0.1. These need separate evidence and design.

## 3. Workflow

1. `contextport inspect --input FILE --format ADAPTER` prints counts of supported/unsupported records, suspected secret matches by **category/count**, and expected output size; it does not show raw content.
2. `contextport convert --input FILE --format ADAPTER --output FILE` parses, normalizes, redacts, deduplicates, serializes, and verifies before publishing the resulting file.
3. `contextport verify --input FILE` checks schema version, IDs, project scoping, ordering, and structural validity. It must not claim perfect secret detection.

Refuse to overwrite an output without `--overwrite`. Refuse equal input/output paths. Failure must leave the source untouched and remove only temporary files created by this invocation.

## 4. Components

```text
CLI arguments
  -> input adapters (Markdown, generic JSONL, Codex, Claude)
  -> neutral-record normalization
  -> privacy redaction
  -> project-scoped deduplication
  -> JSON / Markdown output
  -> validation + safe report
```

- `src/cli/`: command parsing, validation, safe errors, exit codes.
- `src/adapters/`: independent parsers returning typed records and warnings.
- `src/core/`: schema, normalization, redaction, deduplication.
- `src/output/`: serializers and safe atomic output.
- `src/report/`: counts, warnings, and validation.
- `tests/fixtures/`: invented data only, never real user transcripts.

The core pipeline operates on in-memory typed records; only the CLI/I/O boundary touches files. Streaming JSONL prevents loading giant input files fully into memory.

## 5. Privacy and error policy

- Read **only** files selected explicitly by the user; do not crawl a home directory or auto-detect private history.
- Redact in memory before writing any final or temporary output; never print malformed raw input lines, tokens, or private conversation snippets in error messages.
- Sanitized provenance contains an adapter name, safe source label, and record position, not raw absolute paths or personal IDs.
- Unknown formats and malformed records produce explicit warnings; record/file-size limits prevent unbounded consumption.
- Write a verified temporary sibling file then rename atomically when supported. Never overwrite existing output by default.
- Public GitHub content includes code and synthetic fixtures only. Ignore `.env`, credentials, real exports, private memory databases, generated output, and session data.
- Security documentation states redaction is best-effort; users inspect generated exports before sharing them.

## 6. Test and release bar

Unit and integration tests cover supported parser variants, unknown records, secret patterns, project boundaries, stable deduplication, checksum preservation of input, overwrite refusal, atomic failure cleanup, and `verify` behavior. CI runs on Windows, Linux, and macOS. Publish English quickstart, limitations, contribution guide, security policy, changelog, MIT license, and an initial tagged release.

Do not publish any of Yiğit's private SafeKids, Shared Brain, or chat records. Build only new generic code and fabricated fixtures.

## 7. OpenAI program integrity

After developing and testing, publish a new public repository and seek legitimate users and maintainers. Describe only verified GitHub activity and adoption in any Codex for Open Source application. Potential API credits would support genuine pull-request review, issue triage, and release workflows, not fictional usage. OpenAI alone decides eligibility.
