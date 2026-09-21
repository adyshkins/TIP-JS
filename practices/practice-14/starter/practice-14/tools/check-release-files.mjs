import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const required = [
  '.dockerignore',
  '.env.example',
  '.github/workflows/quality.yml',
  'CHANGELOG.md',
  'Dockerfile',
  'README.md',
  'compose.yaml',
  'docs/DEMO.md',
  'docs/OPERATIONS.md',
];

for (const path of required) {
  await access(new URL(`../${path}`, import.meta.url));
}

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(packageJson.version, /^\d+\.\d+\.\d+$/, 'version должна иметь формат X.Y.Z');

for (const path of ['README.md', 'CHANGELOG.md', 'docs/DEMO.md', 'docs/OPERATIONS.md']) {
  const content = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.doesNotMatch(content, /_заполнить_|TODO PR14/, `${path}: остались незаполненные места`);
}

console.log('Обязательные релизные файлы присутствуют и заполнены.');
