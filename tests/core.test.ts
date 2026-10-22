import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicate, normalizeRecord, validateDocument } from '../src/core/records.ts';

test('normalizes whitespace and preserves readable message lines', () => {
  const record = normalizeRecord({ source: 'markdown', project: 'demo', kind: 'note', content: '  Build  locally \r\n  No cloud.  ', position: 1 });
  assert.equal(record.content, 'Build  locally\nNo cloud.');
  assert.equal(record.project, 'demo');
  assert.match(record.id, /^[a-f0-9]{16}$/);
  assert.deepEqual(record.provenance, { adapter: 'markdown', position: 1 });
});

test('deduplicates within a project but never across projects', () => {
  const base = { source: 'jsonl', kind: 'decision', content: 'Ship offline', position: 1 } as const;
  const a = normalizeRecord({ ...base, project: 'alpha' });
  const again = normalizeRecord({ ...base, project: 'alpha', position: 2 });
  const other = normalizeRecord({ ...base, project: 'beta' });
  assert.equal(deduplicate([a, again, other]).length, 2);
  assert.equal(a.id, again.id);
  assert.notEqual(a.id, other.id);
});

test('validates a versioned portable document and rejects invalid IDs', () => {
  const record = normalizeRecord({ source: 'markdown', kind: 'note', project: 'alpha', content: 'Hello', position: 1 });
  assert.deepEqual(validateDocument({ schemaVersion: 1, records: [record] }), []);
  assert.ok(validateDocument({ schemaVersion: 2, records: [record] }).length > 0);
  assert.ok(validateDocument({ schemaVersion: 1, records: [{ ...record, id: 'invalid' }] }).length > 0);
});

test('rejects duplicate IDs and unsorted records', () => {
  const a = normalizeRecord({ source: 'markdown', kind: 'note', project: 'alpha', content: 'A', position: 1 });
  const b = normalizeRecord({ source: 'markdown', kind: 'note', project: 'alpha', content: 'B', position: 2 });
  assert.ok(validateDocument({ schemaVersion: 1, records: [a, a] }).length > 0);
  assert.ok(validateDocument({ schemaVersion: 1, records: [b, a] }).length > 0);
});
