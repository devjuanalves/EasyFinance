export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}
// Express identifies error handlers by their four-argument signature.
export function errorHandler(error, _req, res, _next) {
  if (error.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Invalid JSON' });
  if (error.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request body too large' });
  console.error('Unhandled API error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
}
