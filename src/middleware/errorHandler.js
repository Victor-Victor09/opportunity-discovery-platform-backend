import { ka } from "zod/locales";

export function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.originalUrl}`,
  });
}

export function errorHandler(error, req, res, _next) {
  req.log?.error({ err: error }, 'Unhandled application error');

  const statusCode = error.statusCode || 500;
  const message = 
    statusCode >= 500
      ? 'Internal server error'
      : error.message || 'An error occurred';

  res.status(statusCode).json({
    status: 'error',
    message,
  });
}
