// Upload only known financial-summary captures from fictional browser fixtures.
// Never collect traces, HTML reports, storage state, invitations or auth screens.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
const mode = process.env.EASYFINANCE_BROWSER_MODE;
if (!['demo', 'api'].includes(mode))
  throw new Error('Explicit browser mode required');
mkdirSync('test-results/ci-safe', { recursive: true });
for (const viewport of ['desktop', 'mobile']) {
  const source = `test-results/${mode === 'api' ? 'block10a-layouts' : 'block2-layouts'}/${viewport}-dashboard.png`;
  if (existsSync(source))
    copyFileSync(
      source,
      `test-results/ci-safe/${mode}-${viewport}-dashboard.png`,
    );
}
