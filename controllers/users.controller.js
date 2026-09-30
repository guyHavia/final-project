import { User, ROLE, ROLES, createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { sendData } from '../lib/respond.js';
import { AppError } from '../lib/AppError.js';
import { escapeRegex, isObjectId, clampLimit } from '../lib/query.js';
import { destroySessionsForUser } from '../config/session.js';

const PASSWORD_MIN_CHARS = 10;
/** bcrypt silently truncates input beyond 72 bytes, so refuse it instead. */
const PASSWORD_MAX_BYTES = 72;
const USERNAME_MAX = 64;
const DISPLAY_NAME_MAX = 100;

const CREATE_FIELDS = ['username', 'password', 'role', 'displayName'];
const UPDATE_FIELDS = ['role', 'displayName', 'active', 'password'];
const ME_FIELDS = ['displayName', 'password', 'currentPassword'];

function toUserView(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

/** The body must be a plain object whose keys are all in `allowed`. */
function requireKnownFields(body, allowed) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw AppError.badRequest('body must be an object');
    }
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
        throw AppError.badRequest(`unknown field: ${unknown.join(', ')}`);
    }
}

function cleanText(value, field, maxLength) {
    if (typeof value !== 'string') throw AppError.badRequest(`${field} must be a string`);
    const text = value.trim();
    if (text === '') throw AppError.badRequest(`${field} must not be empty`);
    if (text.length > maxLength) throw AppError.badRequest(`${field} must be at most ${maxLength} characters`);
    return text;
}

function checkPassword(value) {
    if (typeof value !== 'string') throw AppError.badRequest('password must be a string');
    if (value.length < PASSWORD_MIN_CHARS) {
        throw AppError.badRequest(`password must be at least ${PASSWORD_MIN_CHARS} characters`);
    }
    if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
        throw AppError.badRequest(`password must be at most ${PASSWORD_MAX_BYTES} bytes`);
    }
}

function checkRole(value) {
    if (typeof value !== 'string' || !ROLES.includes(value)) throw AppError.badRequest('invalid role');
}

function checkActive(value) {
    if (typeof value !== 'boolean') throw AppError.badRequest('active must be a boolean');
}

async function findTarget(id) {
    const user = isObjectId(id) ? await User.findById(id) : null;
    if (!user) throw AppError.notFound('user not found');
    return user;
}

/** An editor may not lock themselves out of the newsroom. */
function forbidSelf(req, user, action) {
    if (user.id === req.user.id) throw AppError.forbidden(`you cannot ${action} your own account`);
}

/** Refuse to remove the last active editor, so someone can always administer users. */
async function requireAnotherActiveEditor(user) {
    if (user.role !== ROLE.EDITOR || !user.active) return;
    const others = await User.countDocuments({ role: ROLE.EDITOR, active: true, _id: { $ne: user._id } });
    if (others === 0) throw AppError.conflict('cannot remove the last active editor');
}

export async function create(req, res) {
    requireKnownFields(req.body, CREATE_FIELDS);
    const { username, password, role, displayName } = req.body;
    if ([username, password, role, displayName].some((v) => v === undefined || v === '')) {
        throw AppError.badRequest('missing fields');
    }
    const cleanUsername = cleanText(username, 'username', USERNAME_MAX).toLowerCase();
    const cleanName = cleanText(displayName, 'displayName', DISPLAY_NAME_MAX);
    checkRole(role);
    checkPassword(password);

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
        throw AppError.conflict('username taken');
    }

    const user = await createUser({ username: cleanUsername, password, role, displayName: cleanName });
    sendData(res, toUserView(user), 201);
}

export async function list(req, res) {
    const { q, cursor } = req.query;
    const limit = clampLimit(req.query.limit, { defaultLimit: 20, maxLimit: 100 });

    if (q !== undefined && typeof q !== 'string') throw AppError.badRequest('q must be a string');
    if (cursor !== undefined && !isObjectId(cursor)) throw AppError.badRequest('invalid cursor');

    const query = {};
    if (q) {
        query.username = { $regex: escapeRegex(q), $options: 'i' };
    }
    if (cursor) {
        query._id = { $gt: cursor };
    }

    const users = await User.find(query).sort({ _id: 1 }).limit(limit + 1);

    let nextCursor = null;
    if (users.length > limit) {
        users.pop();
        nextCursor = users[users.length - 1].id;
    }

    sendData(res, {
        users: users.map(toUserView),
        nextCursor
    });
}

export async function getOne(req, res) {
    sendData(res, toUserView(await findTarget(req.params.id)));
}

export async function update(req, res) {
    const user = await findTarget(req.params.id);
    requireKnownFields(req.body, UPDATE_FIELDS);
    const { role, displayName, active, password } = req.body;

    // Validate everything before touching the user or any session.
    if (role !== undefined) checkRole(role);
    if (active !== undefined) checkActive(active);
    const cleanName = displayName === undefined ? undefined : cleanText(displayName, 'displayName', DISPLAY_NAME_MAX);
    if (password !== undefined) checkPassword(password);

    const demoting = role !== undefined && role !== ROLE.EDITOR;
    const deactivating = active === false;
    if ((demoting || deactivating) && user.role === ROLE.EDITOR && user.active) {
        forbidSelf(req, user, deactivating ? 'deactivate' : 'demote');
        await requireAnotherActiveEditor(user);
    }

    if (role !== undefined) user.role = role;
    if (cleanName !== undefined) user.displayName = cleanName;
    if (active !== undefined) user.active = active;
    if (password !== undefined) await user.setPassword(password);

    await user.save();
    if (deactivating) await destroySessionsForUser(user.id);
    sendData(res, toUserView(user));
}

export async function remove(req, res) {
    const user = await findTarget(req.params.id);
    forbidSelf(req, user, 'delete');
    await requireAnotherActiveEditor(user);

    const articleCount = await Article.countDocuments({ author: user.id });
    if (articleCount === 0) {
        await user.deleteOne();
        await destroySessionsForUser(user.id);
        sendData(res, { ok: true, deleted: 'hard' });
    } else {
        user.active = false;
        await user.save();
        await destroySessionsForUser(user.id);
        sendData(res, { ok: true, deleted: 'soft' });
    }
}

export async function updateMe(req, res) {
    requireKnownFields(req.body, ME_FIELDS);
    const { displayName, password, currentPassword } = req.body;

    const cleanName = displayName === undefined ? undefined : cleanText(displayName, 'displayName', DISPLAY_NAME_MAX);
    if (password !== undefined) {
        checkPassword(password);
        if (currentPassword === undefined || currentPassword === '') {
            throw AppError.badRequest('currentPassword required');
        }
        if (typeof currentPassword !== 'string') throw AppError.badRequest('currentPassword must be a string');
    }

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) {
        throw AppError.unauthorized('user not found');
    }

    if (password !== undefined) {
        const isValid = await user.verifyPassword(currentPassword);
        if (!isValid) {
            throw AppError.unauthorized('wrong password');
        }
        await user.setPassword(password);
    }
    if (cleanName !== undefined) user.displayName = cleanName;

    await user.save();
    sendData(res, toUserView(user));
}
