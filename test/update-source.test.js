import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, copyFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

test('mise à jour : extraire, valider et renouveler le cache depuis un PDF téléchargé', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ena-update-test-'));
  const server = createServer((request, response) => {
    response.end('<link href="https://ps.calameoassets.com/new-revision/p1.jpg?token=test">');
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await mkdir(join(dir, 'scripts'));
    await mkdir(join(dir, 'input'));
    for (const name of ['update-source.mjs', 'extract.mjs', 'calameo.mjs']) {
      await copyFile(resolve('scripts', name), join(dir, 'scripts', name));
    }
    await symlink(resolve('node_modules'), join(dir, 'node_modules'), 'junction');
    await copyFile('data.json', join(dir, 'data.json'));
    await copyFile('sw.js', join(dir, 'sw.js'));
    const source = JSON.parse(await readFile('source.json', 'utf8'));
    source.url = `http://127.0.0.1:${server.address().port}/`;
    source.revision = 'old-revision';
    await writeFile(join(dir, 'source.json'), JSON.stringify(source));
    await exec(process.execPath, ['scripts/update-source.mjs', resolve('input/20261120-liste-Asmat-internet.pdf')], {
      cwd: dir, env: { ...process.env, EXPECTED_REVISION: 'new-revision' }, timeout: 60000
    });
    const updated = JSON.parse(await readFile(join(dir, 'source.json'), 'utf8'));
    assert.equal(updated.revision, 'new-revision');
    assert.equal(updated.pdfDate, source.pdfDate);
    assert.equal(JSON.parse(await readFile(join(dir, 'data.json'), 'utf8')).length, JSON.parse(await readFile('data.json', 'utf8')).length);
    assert.match(await readFile(join(dir, 'sw.js'), 'utf8'), /const CACHE = 'petits-liens-pdf-new-revision';/);
    assert.deepEqual(await readFile(join(dir, 'input', '20261120-liste-Asmat-internet.pdf')), await readFile('input/20261120-liste-Asmat-internet.pdf'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
