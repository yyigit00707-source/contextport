# Security policy

ContextPort is a local-only conversion utility, not a full data-loss prevention product. Its secret redaction is heuristic. **Treat generated files as sensitive until you personally review them.**

## Reporting vulnerabilities

Please do **not** include secrets, private AI conversations, identity documents or credentials in public GitHub issues or pull requests. For vulnerabilities involving private material, contact the maintainer privately using GitHub's repository security advisory reporting feature when enabled.

Report: affected CLI version, minimal **fabricated** reproducer, expected and actual behavior, and platform. The maintainer will acknowledge valid reports as capacity permits; no guaranteed SLA is promised.

## Intended protections

- No API tokens are required; no telemetry, browser sessions, or network calls are used by the CLI.
- Only explicitly selected local files are read. Symbolic-link inputs are rejected.
- Source records are sanitized in memory before any staged output is written.
- Output publication never replaces a file without `--overwrite` and uses secure temporary files.
- Errors and parser diagnostics do not echo input content.

## Known limitations

- Novel token formats, secrets inside arbitrary prose, and personally identifying details may remain. Email and phone matching require `--personal`.
- `verify` tests structure and stable IDs, not confidentiality or semantic fidelity.
- Extremely large input files are not supported; maximum size is 8 MiB.
- JSONL parsing is bounded by file size, not a streaming disk reader in this release.
- Anyone with access to the chosen output file can read any text that was not masked.
