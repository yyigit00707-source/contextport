import { readExplicitFile, publishFile } from '../output/files.ts';
import { parseSource } from '../adapters/index.ts';
import { deduplicate, validateDocument, type Adapter, type PortableDocument } from '../core/records.ts';
import { sanitizeRecords } from '../core/redact.ts';

type Command = 'inspect' | 'convert' | 'verify';
interface Options {
  input?: string;
  format?: Adapter;
  output?: string;
  to?: 'json' | 'md';
  project?: string;
  personal?: boolean;
  overwrite?: boolean;
}

const usage = `ContextPort v0.1 — local-only context migration\n\nUsage:\n  contextport inspect --input FILE --format markdown|jsonl|codex|claude\n  contextport convert --input FILE --format ADAPTER --output FILE [--to json|md] [--project NAME] [--personal] [--overwrite]\n  contextport verify --input FILE\n\nPrivacy: no network calls; best-effort redaction is not a security guarantee.`;

function optionsFrom(argv: string[]): { command: Command; options: Options } {
  const command = argv[0];
  if (!['inspect', 'convert', 'verify'].includes(command || '')) throw new Error('Unknown command; run --help');
  const options: Options = {};
  const supported = new Set(['--input', '--format', '--output', '--to', '--project', '--personal', '--overwrite']);
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i]!;
    if (!supported.has(key)) throw new Error('Unknown option');
    if (key === '--personal') { options.personal = true; continue; }
    if (key === '--overwrite') { options.overwrite = true; continue; }
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error('Missing option value');
    if (key === '--input') options.input = value;
    else if (key === '--output') options.output = value;
    else if (key === '--format') options.format = value as Adapter;
    else if (key === '--to') options.to = value as 'json' | 'md';
    else if (key === '--project') options.project = value;
  }
  if (!options.input) throw new Error('Missing --input');
  if (command !== 'verify' && !['markdown', 'jsonl', 'codex', 'claude'].includes(options.format || '')) throw new Error('Invalid --format');
  if (command === 'convert' && !options.output) throw new Error('Missing --output');
  if (options.to && !['json', 'md'].includes(options.to)) throw new Error('Invalid --to');
  if (command !== 'convert' && (options.output || options.to || options.overwrite)) throw new Error('Output options only apply to convert');
  if (command === 'verify' && (options.format || options.project || options.personal)) throw new Error('Verify accepts only --input');
  return { command: command as Command, options };
}

function renderMarkdown(document: PortableDocument): string {
  const lines = ['# ContextPort Export', '', 'Schema version: 1', '', '> Sanitized export. Review manually before sharing.', ''];
  for (const record of document.records) {
    lines.push(`## ${record.kind} — ${record.project}`, '', `Source: ${record.source} (record ${record.provenance.position})`, '', record.content, '', '---', '');
  }
  return lines.join('\n');
}

export async function runCli(args: string[], out: (message: string) => void = console.log, error: (message: string) => void = console.error): Promise<number> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') { out(usage); return 0; }
  if (args[0] === '--version') { out('0.1.0'); return 0; }
  try {
    const { command, options } = optionsFrom(args);
    const sourceText = await readExplicitFile(options.input!);
    if (command === 'verify') {
      let data: unknown;
      try { data = JSON.parse(sourceText); }
      catch { throw new Error('Invalid JSON document'); }
      const validation = validateDocument(data);
      if (validation.length) {
        error(`Verification failed: ${validation.length} structural issue(s)`);
        return 1;
      }
      out(`Verified ${((data as PortableDocument).records).length} records (schema v1).`);
      return 0;
    }
    const parsed = parseSource(sourceText, options.format!, { project: options.project });
    const sanitized = sanitizeRecords(parsed.records, { personal: options.personal });
    const records = deduplicate(sanitized.records);
    const document: PortableDocument = { schemaVersion: 1, records };
    const issues = validateDocument(document);
    if (issues.length) throw new Error('Normalized output did not pass validation');
    if (command === 'inspect') {
      out(`Supported records: ${parsed.records.length}`);
      out(`Skipped records: ${parsed.skipped}`);
      out(`Duplicate records: ${sanitized.records.length - records.length}`);
      out(`Estimated JSON bytes: ${Buffer.byteLength(JSON.stringify(document))}`);
      out('Suspected secret matches (best effort):');
      for (const [category, count] of Object.entries(sanitized.counts)) out(`  ${category}: ${count}`);
      if (parsed.warnings.length) out(`Safe parser warnings: ${parsed.warnings.join('; ')}`);
      return 0;
    }
    if (!records.length) throw new Error('No supported records to export');
    const result = options.to === 'md' ? renderMarkdown(document) : JSON.stringify(document, null, 2) + '\n';
    await publishFile(options.input!, options.output!, result, options.overwrite || false);
    out(`Exported ${records.length} sanitized records. Review the output before sharing.`);
    return 0;
  } catch {
    // Never include raw path, parse content, underlying I/O messages, or argument values in diagnostics.
    error('ContextPort could not complete the operation. Check options, paths, file permissions, and size limits.');
    return 1;
  }
}
