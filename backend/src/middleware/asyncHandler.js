// Express 4 doesn't catch rejected promises from async route handlers on its own —
// without this, any thrown/rejected error (bad input, a failed upload, a DB hiccup)
// crashes the whole process instead of just failing that one request.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
