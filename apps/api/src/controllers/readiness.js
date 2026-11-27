// Coalesce simultaneous probes and bound response time without exposing DB identity.
export function readiness(db, isStopping = () => false) {
  let pending;
  return async (_req, res) => {
    if (!db || isStopping())
      return res.status(503).json({ status: 'not_ready' });
    if (!pending) {
      pending = (async () => {
        let timer;
        try {
          await Promise.race([
            db.$queryRaw`SELECT 1`,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('Readiness deadline')),
                3000,
              );
            }),
          ]);
          return true;
        } catch {
          return false;
        } finally {
          clearTimeout(timer);
        }
      })().finally(() => {
        pending = null;
      });
    }
    const ready = (await pending) && !isStopping();
    return res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'not_ready' });
  };
}
