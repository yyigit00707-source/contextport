# ContextPort

> Export selected coding-assistant context into portable, reviewable files — locally and with secret redaction on by default.

ContextPort is a small, independent, open-source TypeScript CLI for developers who want to migrate project notes and conversations between tools without uploading them to a third party. It **does not connect to AI APIs, collect telemetry, or scan your home directory**.

**Status:** early v0.1; independently developed, not affiliated with OpenAI or Anthropic. This project does not imply endorsement by either company.

## Why ContextPort?

- Choose an input file yourself; no background discovery or account login.
- Inspect record counts and suspected secrets without revealing message content.
- Convert plain Markdown, neutral JSON Lines, selected Codex JSONL messages, and selected Claude Code JSONL messages into a versioned portable JSON document or readable Markdown.
- Mask recognizable API tokens, Bearer credentials, `.env` secrets and PEM private keys. Opt in to email and phone masking with `--personal`.
- Preserve the original file and refuse overwrites unless you pass `--overwrite`.
- Validate portable JSON files after conversion with `verify`.

## Requirements

Node.js **22.10 or newer** (22.10+ supports the experimental TypeScript strip-types flag used by the CLI; Node 24 is recommended). No cloud account or API key required.

## Quickstart

```bash
git clone https://github.com/yyigit00707-source/contextport.git
cd contextport
npm ci
npm test

node bin/contextport.mjs inspect --input examples/notes.md --format markdown
node bin/contextport.mjs convert --input examples/notes.md --format markdown --output notes.export.json --project demo
node bin/contextport.mjs verify --input notes.export.json
```

`npm ci` installs test/typecheck-only development packages; **the CLI has zero runtime dependencies**. You can also launch `node --experimental-strip-types src/cli/main.ts` directly. Use `npm run check` for TypeScript verification.

## Supported formats

| Input | `--format` | Interpretation |
| --- | --- | --- |
| Markdown note | `markdown` | The file is one note record; headings and paragraphs are preserved |
| Generic JSONL | `jsonl` | Each line with `kind` (`note`, `decision`, `message`, or `lesson`) and a string `content` is one record |
| Local Codex JSONL | `codex` | User/assistant text message records, including supported `response_item` / `event_msg` shapes |
| Local Claude Code JSONL | `claude` | User/assistant text message blocks only; tool calls, tool results and metadata are skipped |

Code-assistant session formats can change. **Skipped or malformed records are counted and warned about, never guessed**. This tool does not produce model-ready conversation history, summarize conversations, or automatically import content into another provider.

Examples for the invented JSONL records are available under `examples/`. Convert with `--format codex`, `--format claude`, or `--format jsonl` as appropriate.

## Commands

```bash
contextport inspect --input FILE --format markdown|jsonl|codex|claude [--project NAME] [--personal]

contextport convert --input FILE --format ADAPTER --output FILE \
  [--to json|md] [--project NAME] [--personal] [--overwrite]

contextport verify --input exported.json
```

`--to md` creates human-readable Markdown; `verify` checks the **JSON schema only**. The exported JSON uses `schemaVersion: 1`, and each record stores a generated ID, source adapter, project, kind, sanitized content, optional timestamp, and a safe adapter/position provenance.

By default, all records are under the project name `default`; in generic JSONL, per-line `project` is preserved unless you override it with `--project`. Duplicate project/kind/content records are removed within the same project, retaining first-seen order. There is an 8 MiB input-file limit and a 500,000-character record limit to bound memory use.

## Privacy and security limitations

**Redaction is best-effort, not a security boundary.** It can miss unfamiliar secrets, personal names, addresses, unusual token formats, and secrets embedded in images or binary files. `verify` validates structure and IDs — **it does not certify that an export is safe to publish**. Always read the resulting export before sharing it.

- The CLI does not require API credentials and makes no network calls.
- Only files you explicitly name are read. Symbolic-link inputs are refused.
- Input files remain untouched. Files are written in the output directory via a private temporary file and an atomic publication step; overwrite is opt-in.
- Outputs may still include sensitive information. Store them privately, and do not open a PR containing real transcripts.
- Parser warnings identify record positions and categories, not raw source messages.
- UTF-8 text only; no PDF, DOCX, image, binary, database or remote-source support.

## Development

```bash
npm ci
npm test
npm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md). MIT licensed.

## Roadmap

- More tested format versions and adapters, based on public and synthetic fixtures.
- Optional filtering and selected project exports.
- Additional secret detectors and adversarial tests.

No account scraping, automatic cloud sync, paid service or AI inference is planned for v0.1.
