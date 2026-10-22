import { constants } from 'node:fs';
import { open, lstat, readFile, realpath, rename, link, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export async function readExplicitFile(input: string): Promise<string> {
  const info = await lstat(input);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Input must be a regular file, not a symbolic link');
  if (info.size > MAX_INPUT_BYTES) throw new Error('Input exceeds 8 MiB limit');
  const handle = await open(input, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const actual = await handle.stat();
    if (!actual.isFile() || actual.size > MAX_INPUT_BYTES) throw new Error('Input exceeds safe file limits');
    const data = await handle.readFile('utf8');
    if (Buffer.byteLength(data, 'utf8') > MAX_INPUT_BYTES) throw new Error('Input exceeds 8 MiB limit');
    return data;
  } finally { await handle.close(); }
}

async function checkDistinctPaths(input: string, output: string): Promise<void> {
  const source = await realpath(input);
  const outputParent = await realpath(dirname(resolve(output)));
  const target = join(outputParent, basename(output));
  const compare = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (compare(source) === compare(target)) throw new Error('Input and output must differ');
}

export async function publishFile(input: string, output: string, content: string, overwrite: boolean): Promise<void> {
  await checkDistinctPaths(input, output);
  try {
    const stat = await lstat(output);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Output must be a regular file');
    if (!overwrite) throw new Error('Output already exists; use --overwrite to replace');
  } catch (err) {
    if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) throw err;
  }
  const temp = join(dirname(resolve(output)), `.${basename(output)}.${randomUUID()}.tmp`);
  let created = false;
  try {
    const handle = await open(temp, 'wx', 0o600);
    created = true;
    try { await handle.writeFile(content, { encoding: 'utf8' }); await handle.sync(); }
    finally { await handle.close(); }
    if (overwrite) await rename(temp, output);
    else {
      // A same-directory hard link creates the final name atomically without replacing it.
      await link(temp, output);
      await unlink(temp);
    }
    created = false;
  } finally {
    if (created) await unlink(temp).catch(() => undefined);
  }
}
