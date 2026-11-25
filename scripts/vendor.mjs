import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('vendor', { recursive: true });
await Promise.all([
  copyFile('node_modules/write-excel-file/bundle/write-excel-file.min.js', 'vendor/write-excel-file.min.js'),
  copyFile('node_modules/write-excel-file/LICENSE', 'vendor/write-excel-file-LICENSE.txt'),
  copyFile('node_modules/fflate/LICENSE', 'vendor/fflate-LICENSE.txt')
]);
