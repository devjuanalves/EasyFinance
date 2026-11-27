import { disposableDatabaseUrl } from '../../database/scripts/safety.js';
export function rehearsalTarget(source) {
  const url = new URL(disposableDatabaseUrl(source));
  if (
    source.EASYFINANCE_BACKUP_REHEARSAL !== 'yes' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/easyfinance_test_disposable_ci' ||
    url.username !== 'postgres'
  )
    throw new Error(
      'Backup rehearsal requires the isolated CI cluster and explicit acknowledgement.',
    );
  return url;
}
