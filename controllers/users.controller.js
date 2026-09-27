import { User, createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { sendData } from '../lib/respond.js';
import { AppError } from '../lib/AppError.js';
import { destroySessionsForUser } from '../config/session.js';

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

export async function create(req, res) {
    const { username, password, role, displayName } = req.body;
    if (!username || !password || !role || !displayName) {
        throw AppError.badRequest('missing fields');
    }
    if (role !== 'reporter' && role !== 'editor') {
        throw AppError.badRequest('invalid role');
    }
    
    // Check for duplicate username
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
        throw AppError.conflict('username taken');
    }

    const user = await createUser({ username, password, role, displayName });
    sendData(res, toUserView(user), 201);
}

export async function list(req, res) {
    let { q, cursor, limit } = req.query;
    limit = parseInt(limit, 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 100) limit = 100;

    const query = {};
    if (q) {
        query.username = { $regex: q, $options: 'i' };
    }
    if (cursor) {
        query._id = { $gt: cursor };
    }

    const users = await User.find(query).sort({ _id: 1 }).limit(limit + 1);
    
    let nextCursor = null;
    if (users.length > limit) {
        const nextUser = users.pop();
        nextCursor = users[users.length - 1].id;
    }

    sendData(res, {
        users: users.map(toUserView),
        nextCursor
    });
}

export async function getOne(req, res) {
    const user = await User.findById(req.params.id);
    if (!user) {
        throw AppError.notFound('user not found');
    }
    sendData(res, toUserView(user));
}

export async function update(req, res) {
    const user = await User.findById(req.params.id);
    if (!user) {
        throw AppError.notFound('user not found');
    }

    const { role, displayName, active, password } = req.body;
    
    if (role !== undefined) {
        if (role !== 'reporter' && role !== 'editor') {
            throw AppError.badRequest('invalid role');
        }
        user.role = role;
    }
    if (displayName !== undefined) {
        user.displayName = displayName;
    }
    if (active !== undefined) {
        user.active = active;
        if (active === false) {
            await destroySessionsForUser(user.id);
        }
    }
    if (password !== undefined) {
        await user.setPassword(password);
    }
    
    await user.save();
    sendData(res, toUserView(user));
}

export async function remove(req, res) {
    const user = await User.findById(req.params.id);
    if (!user) {
        throw AppError.notFound('user not found');
    }

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
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) {
        throw AppError.unauthorized('user not found');
    }

    const { displayName, password, currentPassword } = req.body;
    
    if (password !== undefined) {
        if (!currentPassword) {
            throw AppError.badRequest('currentPassword required');
        }
        const isValid = await user.verifyPassword(currentPassword);
        if (!isValid) {
            throw AppError.unauthorized('wrong password');
        }
        await user.setPassword(password);
    }

    if (displayName !== undefined) {
        user.displayName = displayName;
    }

    await user.save();
    sendData(res, toUserView(user));
}
