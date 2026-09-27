/**
 * Parses the request's `Cookie` header into `req.cookies` (name → value).
 * Express does not do this by itself; the comment rate limit reads the guest's
 * `deviceId` from here. Mount once in app.js, before the routes.
 *
 *   "deviceId=abc; theme=dark"  →  { deviceId: 'abc', theme: 'dark' }
 *
 * Malformed pieces are skipped, never thrown on. The first occurrence of a name
 * wins. Values are URL-decoded when they are valid URL encoding.
 */
export function parseCookies(req, res, next) {
  const cookies = {};
  const header = req.headers.cookie;

  if (typeof header === 'string') {
    for (const piece of header.split(';')) {
      const eq = piece.indexOf('=');
      if (eq === -1) continue;

      const name = piece.slice(0, eq).trim();
      const value = piece.slice(eq + 1).trim();
      if (!name || Object.hasOwn(cookies, name)) continue;

      cookies[name] = safeDecode(value);
    }
  }

  req.cookies = cookies;
  next();
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
