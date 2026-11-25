import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractRevision, validateUpdate } from '../scripts/calameo.mjs';

test('révision indépendante du jeton temporaire Calaméo', () => {
  const page = token => `<link rel="image_src" href="https://ps.calameoassets.com/261120171359-abc123/p1.jpg?_token_=${token}">`;
  assert.equal(extractRevision(page('old')), '261120171359-abc123');
  assert.equal(extractRevision(page('new')), extractRevision(page('old')));
  assert.throws(() => extractRevision('<html>indisponible</html>'));
});

test('validation : refuser une extraction vide, incomplète ou une date incohérente', () => {
  const previous = Array(80).fill({});
  assert.doesNotThrow(() => validateUpdate(previous, Array(40).fill({}), '2026-11-20', '2026-12-01'));
  assert.throws(() => validateUpdate(previous, Array(39).fill({}), '2026-11-20', '2026-12-01'));
  assert.throws(() => validateUpdate(previous, [], '2026-11-20', '2026-12-01'));
  assert.throws(() => validateUpdate(previous, previous, '2026-11-20', '2026-11-19'));
  assert.throws(() => validateUpdate(previous, previous, '2026-11-20', '2026-02-30'));
});
