import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../tests', import.meta.url));
const forbidden = [
  /\b(?:test|it|describe)\.(?:only|skip|todo)\s*\(/,
  /\b(?:only|skip|todo)\s*:\s*true\b/,
];

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await files(path)));
    } else if (extname(entry.name) === '.js') {
      result.push(path);
    }
  }
  return result;
}

const violations = [];
for (const path of await files(root)) {
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (forbidden.some((pattern) => pattern.test(line))) {
      violations.push(`${relative(root, path)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Найдены отключённые или незавершённые тесты:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log('Маркеры only/skip/todo не найдены.');
}
