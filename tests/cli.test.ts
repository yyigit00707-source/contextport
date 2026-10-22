import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const runner = resolve('src/cli/main.ts');
const run = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', runner, ...args], { encoding: 'utf8' });

async function sandbox(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = await mkdtemp(join(tmpdir(), 'contextport-test-'));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  return dir;
}

test('inspect prints counts and never reveals input content or secret values', async t => {
  const dir = await sandbox(t);
  const input = join(dir, 'input.md');
  const secret = 'sk-proj-' + 'S'.repeat(40);
  await writeFile(input, `Confidential decision ${secret}`);
  const result = run('inspect', '--input', input, '--format', 'markdown');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Supported records: 1/);
  assert.match(result.stdout, /apiKey: 1/);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
  assert.equal((result.stdout + result.stderr).includes('Confidential decision'), false);
});

test('convert exports redacted valid JSON, preserves input bytes, verify succeeds', async t => {
  const dir = await sandbox(t);
  const input = join(dir, 'source.md');
  const output = join(dir, 'portable.json');
  const secret = 'ghp_' + 'X'.repeat(36);
  const original = `Decision: write once, ${secret}\n`;
  await writeFile(input, original);
  const result = run('convert', '--input', input, '--format', 'markdown', '--output', output, '--project', 'demo');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(input, 'utf8'), original);
  const resultText = await readFile(output, 'utf8');
  assert.equal(resultText.includes(secret), false);
  assert.equal(JSON.parse(resultText).records[0].project, 'demo');
  assert.equal(run('verify', '--input', output).status, 0);
});

test('verify rejects tampered record without printing record content', async t => {
  const dir = await sandbox(t);
  const target = join(dir, 'tampered.json');
  await writeFile(target, JSON.stringify({ schemaVersion: 1, records: [{ id: 'invalid', content: 'private text' }] }));
  const result = run('verify', '--input', target);
  assert.notEqual(result.status, 0);
  assert.equal((result.stdout + result.stderr).includes('private text'), false);
});

test('refuses overwrite by default and preserves existing target', async t => {
  const dir = await sandbox(t);
  const input = join(dir, 'input.md');
  const output = join(dir, 'existing.json');
  await writeFile(input, 'Local note');
  await writeFile(output, 'original target');
  const args = ['convert', '--input', input, '--format', 'markdown', '--output', output];
  assert.notEqual(run(...args).status, 0);
  assert.equal(await readFile(output, 'utf8'), 'original target');
  assert.equal(run(...args, '--overwrite').status, 0);
  assert.match(await readFile(output, 'utf8'), /schemaVersion/);
});

test('refuses equal input and output paths and leaves source untouched', async t => {
  const dir = await sandbox(t);
  const input = join(dir, 'same.md');
  await writeFile(input, 'keep me');
  assert.notEqual(run('convert', '--input', input, '--format', 'markdown', '--output', input, '--overwrite').status, 0);
  assert.equal(await readFile(input, 'utf8'), 'keep me');
});

test('writes Markdown and does not leave temp files when conversion fails', async t => {
  const dir = await sandbox(t);
  const input = join(dir, 'input.md');
  const output = join(dir, 'export.md');
  await writeFile(input, '# Demo\nNothing secret here.');
  assert.equal(run('convert', '--input', input, '--format', 'markdown', '--output', output, '--to', 'md').status, 0);
  assert.match(await readFile(output, 'utf8'), /# ContextPort Export/);
  const bad = run('convert', '--input', join(dir, 'missing.md'), '--format', 'markdown', '--output', join(dir, 'not-created.json'));
  assert.notEqual(bad.status, 0);
  assert.deepEqual((await readdir(dir)).sort(), ['export.md', 'input.md'].sort());
});

test('invalid CLI options fail safely and without stack traces', () => {
  const result = run('unknown-command', '--password', 'do-not-print');
  assert.notEqual(result.status, 0);
  assert.equal((result.stdout + result.stderr).includes('do-not-print'), false);
  assert.equal((result.stdout + result.stderr).includes('at runCli'), false);
});
