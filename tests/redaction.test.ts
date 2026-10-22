import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText, sanitizeRecords } from '../src/core/redact.ts';
import { normalizeRecord } from '../src/core/records.ts';

const openai = 'sk-proj-' + 'Q'.repeat(40);
const github = 'ghp_' + 'D'.repeat(36);
const aws = 'AKIA' + 'A'.repeat(16);

test('redacts common synthetic provider tokens without logging their values', () => {
  const result = redactText(`OpenAI: ${openai}; GitHub: ${github}; AWS: ${aws}`);
  for (const secret of [openai, github, aws]) assert.equal(result.text.includes(secret), false);
  assert.ok(result.counts.apiKey >= 3);
  assert.match(result.text, /\[REDACTED_API_KEY\]/);
});

test('redacts Bearer headers, env secret assignments, and private keys', () => {
  const sample = 'Authorization: Bearer completelyFakeAccessToken99\nMY_API_KEY=untrusted_test_value\n-----BEGIN PRIVATE KEY-----\nFAKEBASE64DATA\n-----END PRIVATE KEY-----';
  const result = redactText(sample);
  assert.equal(result.text.includes('completelyFakeAccessToken99'), false);
  assert.equal(result.text.includes('untrusted_test_value'), false);
  assert.equal(result.text.includes('FAKEBASE64DATA'), false);
  assert.ok(result.counts.credential >= 1);
  assert.ok(result.counts.env >= 1);
  assert.ok(result.counts.privateKey >= 1);
});

test('email and phone redaction are opt-in', () => {
  const sample = 'Contact invented@example.com at +1 415 555 0100';
  assert.match(redactText(sample).text, /invented@example\.com/);
  const result = redactText(sample, { personal: true });
  assert.equal(result.text.includes('invented@example.com'), false);
  assert.equal(result.text.includes('415 555 0100'), false);
  assert.ok(result.counts.email === 1);
  assert.ok(result.counts.phone >= 1);
});

test('sanitization recomputes IDs and preserves project boundaries', () => {
  const records = [normalizeRecord({ source: 'markdown', project: 'demo', kind: 'note', content: `Key: ${openai}`, position: 1 })];
  const result = sanitizeRecords(records);
  assert.notEqual(result.records[0]?.id, records[0]?.id);
  assert.equal(JSON.stringify(result.records).includes(openai), false);
  assert.ok(result.counts.apiKey >= 1);
});
