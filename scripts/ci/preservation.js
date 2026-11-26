import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(readFileSync('docs/design/ASSET_MANIFEST.json'));
const assets = manifest.filter(
  (x) => !x.current.endsWith('.DS_Store') && !x.current.includes('/._'),
);
if (assets.length !== 49)
  throw new Error('Unexpected authoritative asset inventory');
for (const asset of assets) {
  const hash = createHash('sha256')
    .update(readFileSync(asset.current))
    .digest('hex');
  if (hash !== asset.sha256) throw new Error(`Asset changed: ${asset.current}`);
}
const baseline = JSON.parse(readFileSync('scripts/ci/database-baseline.json'));
for (const [path, expected] of Object.entries(baseline)) {
  if (
    createHash('sha256').update(readFileSync(path)).digest('hex') !== expected
  )
    throw new Error(`Database foundation changed: ${path}`);
}
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(
  '\n',
);
if (
  tracked.some(
    (p) => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.env.example'),
  )
)
  throw new Error('Tracked environment file');
console.log(
  `Preserved ${assets.length} assets and ${Object.keys(baseline).length} database foundation files; no tracked environment secrets.`,
);
