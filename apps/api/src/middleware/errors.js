import { ApiError } from '../validation/contracts.js';
export function notFound(req, res, next) {
  if (req.originalUrl.startsWith('/api/v1'))
    return next(new ApiError(404, 'NOT_FOUND', 'Record not found.'));
  res.status(404).json({ error: 'Not found' });
}
export function errorHandler(error, req, res, _next) {
  const v1 = req.originalUrl.startsWith('/api/v1');
  let status = 500,
    code = 'INTERNAL',
    message = 'Internal server error';
  if (error instanceof ApiError) {
    ({ status, code, message } = error);
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION';
    message = 'Invalid JSON';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body too large';
  } else if (
    ['P2002', 'P2003', 'P2004', 'P2010', 'P2025', 'P2034'].includes(error.code)
  ) {
    status = 409;
    code = 'CONFLICT';
    message =
      'The operation conflicts with the current records. Reload and review before retrying.';
  } else if (
    [
      'P1000',
      'P1001',
      'P1002',
      'P1008',
      'P1017',
      'P2024',
      'P2028',
      'ECONNREFUSED',
    ].includes(error.code) ||
    error.name === 'PrismaClientInitializationError'
  ) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Data service is temporarily unavailable.';
  }
  if (status === 500 || status === 503)
    console.error(
      JSON.stringify({ event: 'api_error', requestId: req.requestId, code }),
    );
  res
    .status(status)
    .json(
      v1
        ? { error: { code, message }, requestId: req.requestId }
        : { error: message },
    );
}
