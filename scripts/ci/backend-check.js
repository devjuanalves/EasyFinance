import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? files(`${dir}/${f.name}`) : [`${dir}/${f.name}`],
  );
}
const sources = files('apps/api/src').filter((f) => f.endsWith('.js'));
for (const file of sources)
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
console.log(
  `Native ESM backend syntax passed (${sources.length} files); no backend transpilation required.`,
);
