import { readdirSync, readFileSync } from 'node:fs';
const files = readdirSync('apps/web/dist/assets').filter((f) =>
  f.endsWith('.js'),
);
if (!files.length) throw new Error('Build first');
const prohibited = [
  'react.development.js',
  'react-dom-client.development.js',
  'DATABASE_URL',
  'CI_SERVER_SECRET_SENTINEL',
  'Download the React DevTools',
  'react_stack_bottom_frame',
];
for (const key of ['DATABASE_URL', 'API_DATABASE_URL']) {
  if (process.env[key]) {
    prohibited.push(process.env[key]);
    try {
      const password = decodeURIComponent(new URL(process.env[key]).password);
      if (password.length >= 8) prohibited.push(password);
    } catch {
      /* The build job may use a non-URL sentinel. */
    }
  }
}
for (const file of files) {
  const code = readFileSync(`apps/web/dist/assets/${file}`, 'utf8');
  if (prohibited.some((s) => code.includes(s)))
    throw new Error(`Unsafe build content in ${file}`);
}
console.log(
  'Production bundle checks passed: no development module markers or server secret sentinel.',
);
