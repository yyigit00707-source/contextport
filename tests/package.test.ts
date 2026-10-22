import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

test('npm CLI shim is executable on Unix-like systems', async () => {
  if (process.platform === 'win32') return;
  const info = await stat(new URL('../bin/contextport.mjs', import.meta.url));
  assert.ok((info.mode & 0o111) !== 0, 'The CLI bin needs an executable permission bit');
});
