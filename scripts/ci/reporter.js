// Deliberately excludes errors, stdout, attachments, request bodies and tokens.
import { mkdirSync, writeFileSync } from 'node:fs';
export default class SafeReporter {
  results = [];
  onTestEnd(test, result) {
    this.results.push({
      title: test.title,
      project: test.parent.project()?.name,
      status: result.status,
      durationMs: result.duration,
      retry: result.retry,
    });
  }
  onEnd(result) {
    mkdirSync('test-results/ci-safe', { recursive: true });
    writeFileSync(
      `test-results/ci-safe/${process.env.EASYFINANCE_BROWSER_MODE || 'browser'}.json`,
      JSON.stringify({ status: result.status, tests: this.results }, null, 2),
    );
  }
}
