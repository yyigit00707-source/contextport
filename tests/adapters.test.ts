import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSource } from '../src/adapters/index.ts';

test('parses a Markdown note into one portable record', () => {
  const result = parseSource('# Decision\nKeep local processing.', 'markdown', { project: 'workshop' });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0]?.source, 'markdown');
  assert.equal(result.records[0]?.kind, 'note');
  assert.equal(result.skipped, 0);
});

test('parses generic JSONL with supported fields and skips unknown objects', () => {
  const input = [
    JSON.stringify({ kind: 'decision', content: 'Use offline parsing.', project: 'portable' }),
    JSON.stringify({ type: 'tool_result', value: 'ignore' }),
    '{ malformed secret-looking but do not echo',
  ].join('\n');
  const result = parseSource(input, 'jsonl');
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0]?.kind, 'decision');
  assert.equal(result.records[0]?.project, 'portable');
  assert.equal(result.skipped, 2);
  assert.equal(JSON.stringify(result.warnings).includes('secret-looking'), false);
});

test('Codex adapter extracts message text but skips session metadata and tool calls', () => {
  const input = [
    JSON.stringify({ type: 'session_meta', payload: { id: 'secret-user-id' } }),
    JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Plan a safe migration.' }] } }),
    JSON.stringify({ type: 'response_item', payload: { type: 'function_call', arguments: 'sensitive-input' } }),
  ].join('\n');
  const result = parseSource(input, 'codex', { project: 'demo' });
  assert.deepEqual(result.records.map(x => x.content), ['Plan a safe migration.']);
  assert.equal(result.skipped, 2);
  assert.equal(JSON.stringify(result.records).includes('secret-user-id'), false);
});

test('Claude adapter reads text blocks and discards tool blocks and identifiers', () => {
  const input = [
    JSON.stringify({ type: 'user', uuid: 'secret-uuid', message: { role: 'user', content: 'Remember this architecture.' } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Use local storage.' }, { type: 'tool_use', input: { credential: 'secret' } }] } }),
    JSON.stringify({ type: 'summary', summary: 'unverified' }),
  ].join('\n');
  const result = parseSource(input, 'claude');
  assert.deepEqual(result.records.map(x => x.content), ['Remember this architecture.', 'Use local storage.']);
  assert.equal(result.skipped, 1);
  assert.equal(JSON.stringify(result.records).includes('secret-uuid'), false);
  assert.equal(JSON.stringify(result.records).includes('credential'), false);
});

test('empty notes and unknown format do not silently become records', () => {
  assert.equal(parseSource('  \n  ', 'markdown').skipped, 1);
  assert.throws(() => parseSource('hello', 'unsupported' as 'markdown'), /Unsupported format/);
});
