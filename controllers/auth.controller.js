import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';
import { logger } from '../lib/logger.js';
import { publicUser } from '../lib/userView.js';
import { User, verifyDummyPassword } from '../models/user.model.js';
import { loginLimiter } from '../middleware/loginLockout.js';

export async function login(req, res) {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    throw AppError.badRequest('username and password are required');
  }

  const normalizedUsername = String(username).toLowerCase().trim();
  const ip = req.ip ?? 'unknown';

  // Reserve the attempt synchronously, before any await, so parallel bursts are counted.
  if (!loginLimiter.reserve(normalizedUsername, ip).allowed) {
    throw AppError.tooManyRequests('too many failed login attempts, try again later');
  }

  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');
  const usable = !!user && user.active !== false;

  // One message for unknown user, wrong password, or deactivated account — no enumeration.
  // Unknown/inactive users still pay for a bcrypt compare so timing doesn't reveal them.
  const ok = usable ? await user.verifyPassword(password) : await verifyDummyPassword(password);
  if (!ok) {
    logger.warn('auth.login.fail', { username: normalizedUsername.slice(0, 64) });
    throw AppError.unauthorized('invalid credentials');
  }

  loginLimiter.succeed(normalizedUsername, ip);
  // Fresh session id at login (session-fixation defence); the old id is discarded.
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.user = { id: user.id, role: user.role };
  logger.info('auth.login.success', { userId: user.id });
  sendData(res, publicUser(user));
}

export async function logout(req, res) {
  const userId = req.session?.user?.id ?? null;

  await new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });

  res.clearCookie('connect.sid');
  logger.info('auth.logout', { userId });
  sendData(res, { ok: true });
}

export async function me(req, res) {
  if (!req.user) throw AppError.unauthorized();
  sendData(res, publicUser(req.user));
}
