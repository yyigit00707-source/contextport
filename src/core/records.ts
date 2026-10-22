import { createHash } from 'node:crypto';

export type Adapter = 'markdown' | 'jsonl' | 'codex' | 'claude';
export type RecordKind = 'note' | 'decision' | 'message' | 'lesson';

export interface PortableRecord {
  id: string;
  source: Adapter;
  project: string;
  kind: RecordKind;
  content: string;
  createdAt?: string;
  provenance: { adapter: Adapter; position: number };
}

export interface PortableDocument {
  schemaVersion: 1;
  records: PortableRecord[];
}

export type RecordInput = Omit<PortableRecord, 'id' | 'provenance' | 'content' | 'project'> & {
  content: string;
  project: string;
  position: number;
};

const adapters: Adapter[] = ['markdown', 'jsonl', 'codex', 'claude'];
const kinds: RecordKind[] = ['note', 'decision', 'message', 'lesson'];

export function normalizeRecord(input: RecordInput): PortableRecord {
  const content = input.content.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).join('\n').trim();
  const project = input.project.trim() || 'default';
  const id = createHash('sha256').update(JSON.stringify([project, input.kind, content])).digest('hex').slice(0, 16);
  return {
    id,
    source: input.source,
    project,
    kind: input.kind,
    content,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    provenance: { adapter: input.source, position: input.position },
  };
}

export function deduplicate(records: PortableRecord[]): PortableRecord[] {
  const seen = new Set<string>();
  return records.filter(record => {
    const key = JSON.stringify([record.project, record.kind, record.content]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateDocument(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['Expected a document object'];
  const doc = data as Record<string, unknown>;
  if (doc.schemaVersion !== 1) errors.push('Unsupported schema version');
  if (!Array.isArray(doc.records)) return [...errors, 'Expected records array'];
  const seen = new Set<string>();
  const lastPositions = new Map<string, number>();
  for (const [i, unknownRecord] of doc.records.entries()) {
    if (!unknownRecord || typeof unknownRecord !== 'object' || Array.isArray(unknownRecord)) {
      errors.push(`Record ${i + 1}: invalid object`);
      continue;
    }
    const rec = unknownRecord as Record<string, unknown>;
    if (typeof rec.content !== 'string' || !rec.content.trim() || rec.content.length > 500_000 ||
        typeof rec.project !== 'string' || !rec.project.trim() ||
        !adapters.includes(rec.source as Adapter) || !kinds.includes(rec.kind as RecordKind) ||
        !rec.provenance || typeof rec.provenance !== 'object') {
      errors.push(`Record ${i + 1}: invalid fields`);
      continue;
    }
    const prov = rec.provenance as Record<string, unknown>;
    if (prov.adapter !== rec.source || !Number.isSafeInteger(prov.position) || (prov.position as number) < 1 ||
        Object.keys(prov).some(key => !['adapter', 'position'].includes(key))) {
      errors.push(`Record ${i + 1}: invalid provenance`);
    } else {
      const projectKey = String(rec.project);
      const last = lastPositions.get(projectKey) ?? 0;
      if ((prov.position as number) < last) errors.push(`Record ${i + 1}: out of order`);
      lastPositions.set(projectKey, prov.position as number);
    }
    const expected = normalizeRecord({
      source: rec.source as Adapter,
      project: rec.project as string,
      kind: rec.kind as RecordKind,
      content: rec.content as string,
      position: 1,
    });
    if (rec.id !== expected.id) errors.push(`Record ${i + 1}: invalid ID`);
    if (seen.has(String(rec.id))) errors.push(`Record ${i + 1}: duplicate ID`);
    seen.add(String(rec.id));
    if (rec.createdAt !== undefined && (typeof rec.createdAt !== 'string' || !Number.isFinite(Date.parse(rec.createdAt)))) {
      errors.push(`Record ${i + 1}: invalid date`);
    }
    if (Object.keys(rec).some(key => !['id', 'source', 'project', 'kind', 'content', 'createdAt', 'provenance'].includes(key))) {
      errors.push(`Record ${i + 1}: unknown fields`);
    }
  }
  if (Object.keys(doc).some(key => !['schemaVersion', 'records'].includes(key))) errors.push('Unknown document fields');
  return errors;
}
