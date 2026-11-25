import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('vendor', { recursive: true });
async function copyLicense(source, target) {
  const content = await readFile(source, 'utf8');
  await writeFile(target, content.replace(/\r\n/g, '\n'));
}
await Promise.all([
  copyFile('node_modules/write-excel-file/bundle/write-excel-file.min.js', 'vendor/write-excel-file.min.js'),
  copyLicense('node_modules/write-excel-file/LICENSE', 'vendor/write-excel-file-LICENSE.txt'),
  copyLicense('node_modules/fflate/LICENSE', 'vendor/fflate-LICENSE.txt')
]);
