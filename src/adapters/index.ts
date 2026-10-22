import { normalizeRecord, type Adapter, type PortableRecord, type RecordKind } from '../core/records.ts';

export interface ParseResult {
  records: PortableRecord[];
  skipped: number;
  warnings: string[];
}

export interface ParseOptions { project?: string }

type ObjectValue = Record<string, unknown>;
const isObject = (item: unknown): item is ObjectValue => Boolean(item && typeof item === 'object' && !Array.isArray(item));
const validKinds: RecordKind[] = ['note', 'decision', 'message', 'lesson'];

function textContent(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!Array.isArray(value)) return undefined;
  const parts = value.flatMap(item => isObject(item) && ['text', 'input_text', 'output_text'].includes(String(item.type)) && typeof item.text === 'string' ? [item.text] : []);
  return parts.join('\n').trim() || undefined;
}

function extract(raw: ObjectValue, format: Adapter): { kind: RecordKind; content: string; project?: string; createdAt?: string } | undefined {
  if (format === 'jsonl') {
    const content = typeof raw.content === 'string' ? raw.content.trim() : undefined;
    const kind = validKinds.includes(raw.kind as RecordKind) ? raw.kind as RecordKind : raw.role === 'user' || raw.role === 'assistant' ? 'message' : undefined;
    if (!content || !kind) return undefined;
    return { kind, content, ...(typeof raw.project === 'string' ? { project: raw.project } : {}), ...(typeof raw.createdAt === 'string' ? { createdAt: raw.createdAt } : {}) };
  }
  if (format === 'codex') {
    if (raw.type === 'event_msg' && isObject(raw.payload) && raw.payload.type === 'user_message') {
      const content = textContent(raw.payload.message);
      if (content) return { kind: 'message', content };
    }
    if (raw.type !== 'response_item' || !isObject(raw.payload)) return undefined;
    const payload = raw.payload;
    if (payload.type !== 'message' || !['user', 'assistant'].includes(String(payload.role))) return undefined;
    const content = textContent(payload.content);
    return content ? { kind: 'message', content } : undefined;
  }
  if (format === 'claude') {
    if (!['user', 'assistant'].includes(String(raw.type)) || !isObject(raw.message)) return undefined;
    const message = raw.message;
    if (message.role !== raw.type || raw.isSidechain === true) return undefined;
    const content = textContent(message.content);
    return content ? { kind: 'message', content } : undefined;
  }
  return undefined;
}

export function parseSource(text: string, format: Adapter, options: ParseOptions = {}): ParseResult {
  if (!['markdown', 'jsonl', 'codex', 'claude'].includes(format)) throw new Error('Unsupported format');
  if (format === 'markdown') {
    if (!text.trim()) return { records: [], skipped: 1, warnings: ['Empty Markdown input'] };
    if (text.length > 500_000) return { records: [], skipped: 1, warnings: ['Markdown record exceeds safe limit'] };
    return { records: [normalizeRecord({ source: format, project: options.project || 'default', kind: 'note', content: text, position: 1 })], skipped: 0, warnings: [] };
  }
  const records: PortableRecord[] = [];
  let skipped = 0;
  const warnings: string[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const position = index + 1;
    let raw: unknown;
    try { raw = JSON.parse(line); }
    catch { skipped++; warnings.push(`Line ${position}: malformed JSON skipped`); continue; }
    if (!isObject(raw)) { skipped++; warnings.push(`Line ${position}: unsupported record skipped`); continue; }
    const extracted = extract(raw, format);
    if (!extracted || extracted.content.length > 500_000) {
      skipped++;
      warnings.push(`Line ${position}: unsupported or oversized record skipped`);
      continue;
    }
    const createdAt = extracted.createdAt && Number.isFinite(Date.parse(extracted.createdAt)) ? { createdAt: new Date(extracted.createdAt).toISOString() } : {};
    records.push(normalizeRecord({ source: format, project: options.project || extracted.project || 'default', kind: extracted.kind, content: extracted.content, position, ...createdAt }));
  }
  return { records, skipped, warnings };
}
