import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('installation : les ressources sont actualisées avant activation', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const handlers = {};
  let requests;
  let skipped = false;
  const self = {
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: () => { skipped = true; }
  };
  class Request {
    constructor(url, options) { this.url = url; this.cache = options.cache; }
  }
  const caches = { open: async () => ({ addAll: async items => { requests = items; } }) };
  runInNewContext(source, { self, caches, Request });
  let installation;
  handlers.install({ waitUntil: promise => { installation = promise; } });
  await installation;
  assert.ok(requests.some(request => request.url === './index.html'));
  assert.ok(requests.some(request => request.url === './app.js'));
  assert.ok(requests.every(request => request.cache === 'reload'));
  assert.equal(skipped, true);
});
