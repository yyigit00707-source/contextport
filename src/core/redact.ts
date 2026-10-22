import { normalizeRecord, type PortableRecord } from './records.ts';

export type SecretCategory = 'privateKey' | 'credential' | 'env' | 'apiKey' | 'email' | 'phone';
export type RedactionCounts = Record<SecretCategory, number>;

const emptyCounts = (): RedactionCounts => ({ privateKey: 0, credential: 0, env: 0, apiKey: 0, email: 0, phone: 0 });

export function redactText(content: string, options: { personal?: boolean } = {}): { text: string; counts: RedactionCounts } {
  const counts = emptyCounts();
  let text = content;
  const replace = (pattern: RegExp, category: SecretCategory, replacement: string) => {
    text = text.replace(pattern, () => {
      counts[category]++;
      return replacement;
    });
  };

  replace(/-----BEGIN (?:[A-Z0-9 ]* )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]* )?PRIVATE KEY-----/g, 'privateKey', '[REDACTED_PRIVATE_KEY]');
  // Assignment values only; ordinary configuration keys and comments are left intact.
  text = text.replace(/(^|\n)(\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|PASSWD|AUTH)[A-Z0-9_]*\s*[=:]\s*)(['"]?)([^\r\n'"\s]+)\3/gim,
    (_match, prefix: string, key: string) => {
      counts.env++;
      return `${prefix}${key}[REDACTED_ENV]`;
    });
  text = text.replace(/(\bBearer\s+)([A-Za-z0-9._~+/-]{8,}={0,2})/gi, (_match, prefix: string) => {
    counts.credential++;
    return `${prefix}[REDACTED_CREDENTIAL]`;
  });
  replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, 'apiKey', '[REDACTED_API_KEY]');
  if (options.personal) {
    replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'email', '[REDACTED_EMAIL]');
    replace(/(?<!\w)(?:\+?\d[\s().-]?){10,15}(?!\w)/g, 'phone', '[REDACTED_PHONE]');
  }
  return { text, counts };
}

export function sanitizeRecords(records: PortableRecord[], options: { personal?: boolean } = {}): { records: PortableRecord[]; counts: RedactionCounts } {
  const counts = emptyCounts();
  const sanitized = records.map(record => {
    const result = redactText(record.content, options);
    const project = redactText(record.project, options);
    for (const category of Object.keys(counts) as SecretCategory[]) counts[category] += result.counts[category] + project.counts[category];
    return normalizeRecord({ source: record.source, kind: record.kind, project: project.text, content: result.text, position: record.provenance.position, ...(record.createdAt ? { createdAt: record.createdAt } : {}) });
  });
  return { records: sanitized, counts };
}
