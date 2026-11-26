import { appendFileSync } from 'node:fs';
if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV)
  throw new Error('GitHub runner only');
const password = `ci_${process.env.GITHUB_RUN_ID}_${process.env.GITHUB_RUN_ATTEMPT}`;
const url = `postgresql://postgres:${password}@127.0.0.1:5432/easyfinance_test_disposable_ci`;
console.log(`::add-mask::${password}`);
console.log(`::add-mask::${url}`);
appendFileSync(process.env.GITHUB_ENV, `DATABASE_URL=${url}\n`);
