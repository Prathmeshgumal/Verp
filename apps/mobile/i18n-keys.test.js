// Every literal t('…') key and every `…Key: '…'` string used in src must exist in en.json.
const fs = require('fs');
const path = require('path');
const en = require('./src/i18n/en.json');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

function hasKey(key) {
  const value = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), en);
  return typeof value === 'string';
}

test('every translation key used in the app exists in en.json', () => {
  const missing = [];
  for (const file of sourceFiles(path.join(__dirname, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const patterns = [/\bt\(\s*'([A-Za-z0-9_.]+)'/g, /Key:\s*'([A-Za-z0-9_.]+)'/g];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (!hasKey(match[1])) missing.push(`${path.relative(__dirname, file)}: ${match[1]}`);
      }
    }
  }
  expect(missing).toEqual([]);
});
