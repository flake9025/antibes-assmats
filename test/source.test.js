import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractRevision } from '../scripts/calameo.mjs';

test('révision indépendante du jeton temporaire Calaméo', () => {
  const page = token => `<link rel="image_src" href="https://ps.calameoassets.com/261120171359-abc123/p1.jpg?_token_=${token}">`;
  assert.equal(extractRevision(page('old')), '261120171359-abc123');
  assert.equal(extractRevision(page('new')), extractRevision(page('old')));
  assert.throws(() => extractRevision('<html>indisponible</html>'));
});
