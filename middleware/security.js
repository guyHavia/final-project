import { AppError } from '../lib/AppError.js';

/**
 * Content-Security-Policy. The newsroom pages load only same-origin module
 * scripts (`/js/*`), Chart.js (`/vendor/chart.js`) and stylesheets, with no
 * inline <script>/<style>/handlers, so a strict `'self'` policy suffices.
 * Chart.js sizes its canvas through the CSSOM (`el.style.x = ...`), which CSP
 * does not block. `img-src data:` allows inline canvas/placeholder images;
 * `https:` allows article photos, which are stored as links to other sites.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Hand-rolled hardening headers (helmet is not a course-approved library).
 * HSTS is sent only in production, where the app is expected to sit behind TLS.
 */
export function securityHeaders({ nodeEnv = 'development' } = {}) {
  return function securityHeadersMiddleware(req, res, next) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (nodeEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SESSION_COOKIE = 'connect.sid';

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * CSRF defence in depth on top of SameSite=Lax. For state-changing methods:
 *  0. `Sec-Fetch-Site` present -> must be `same-origin` (or `none`).
 *  1. `Origin` present  -> its host must equal the request `Host`.
 *  2. else `Referer` present -> same check on its host.
 *  3. none of these headers -> allowed only if the request carries no session cookie
 *     (a non-browser client with no ambient credentials cannot be CSRF'd).
 *     Browsers always send Origin on cross-origin unsafe requests, so a
 *     cookie-bearing request with neither header is refused.
 * Only the host is compared (not the scheme) so TLS-terminating proxies work.
 */
export function requireSameOrigin() {
  return function requireSameOriginMiddleware(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    // Fetch Metadata: set by the browser, not forgeable by page JS.
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite) {
      if (fetchSite === 'same-origin' || fetchSite === 'none') return next();
      return next(AppError.forbidden('cross-origin request rejected'));
    }

    const source = req.get('origin') ?? req.get('referer');
    if (source) {
      if (hostOf(source) === req.get('host')) return next();
      return next(AppError.forbidden('cross-origin request rejected'));
    }

    if (req.headers.cookie?.includes(`${SESSION_COOKIE}=`)) {
      return next(AppError.forbidden('missing Origin header'));
    }
    return next();
  };
}
