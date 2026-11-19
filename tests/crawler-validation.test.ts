import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCrawlerHosts, validateCrawlerSourceInput } from '../src/lib/crawler-validation.ts';

test('normalizes and deduplicates hostnames', () => {
  assert.deepEqual(normalizeCrawlerHosts('https://Example.com/, example.com\nsub.example.com'), [
    'example.com',
    'sub.example.com',
  ]);
});

test('rejects invalid source ids and hostnames', () => {
  assert.match(validateCrawlerSourceInput({ id: 'Bad ID', name: 'Source', allowedHosts: ['example.com'] }) ?? '', /ID/);
  assert.match(validateCrawlerSourceInput({ id: 'source', name: 'Source', allowedHosts: ['localhost'] }) ?? '', /Hostname/);
  assert.match(validateCrawlerSourceInput({ id: 'source', name: 'Source', allowedHosts: [] }) ?? '', /ít nhất/);
});

test('accepts a bounded public hostname allowlist', () => {
  assert.equal(validateCrawlerSourceInput({
    id: 'truyenfull',
    name: 'TruyenFull',
    allowedHosts: ['truyenfull.example'],
  }), null);
});
