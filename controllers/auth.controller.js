import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';
import { logger } from '../lib/logger.js';
import { publicUser } from '../lib/userView.js';
import { User } from '../models/user.model.js';
import { loginAttempts, isLockedOut, recordFailedLogin, clearLoginFailures } from '../middleware/loginLockout.js';

export async function login(req, res) {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    throw AppError.badRequest('username and password are required');
  }

  const normalizedUsername = String(username).toLowerCase().trim();
  const now = Date.now();

  if (isLockedOut(loginAttempts, normalizedUsername, now)) {
    throw AppError.tooManyRequests('too many failed login attempts, try again later');
  }

  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');

  // One message for unknown user, wrong password, or deactivated account — no enumeration.
  if (!user || user.active === false || !(await user.verifyPassword(password))) {
    recordFailedLogin(loginAttempts, normalizedUsername, now);
    logger.warn('auth.login.fail', { username });
    throw AppError.unauthorized('invalid credentials');
  }

  clearLoginFailures(loginAttempts, normalizedUsername);
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
