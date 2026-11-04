export function getHealth(_req, res) {
  res.json({ status: 'ok', service: 'easyfinance-api' });
}
