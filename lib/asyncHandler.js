/**
 * Wrap an async route handler so a rejected promise reaches Express's error
 * middleware instead of hanging the request.
 *
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
