import { Router } from 'express';

export const newsroomRouter = Router();

/**
 * Session-presence redirect for pages — not authorization. It only checks that
 * *some* signed-in session exists; role checks stay on P1's/P2's /api guards
 * (requireAuth/requireRole). Never duplicate those here.
 */
function requireSession(req, res, next) {
  if (req.session?.user) return next();
  res.redirect('/login');
}

/** Sends a reporter with an editor-only page back to their own area. */
function requireEditorArea(req, res, next) {
  if (req.session.user.role === 'editor') return next();
  res.redirect('/newsroom');
}

function areaFor(role) {
  return role === 'editor' ? '/newsroom/review' : '/newsroom';
}

newsroomRouter.get('/login', (req, res) => {
  const snapshot = req.session?.user;
  if (snapshot) return res.redirect(areaFor(snapshot.role));
  res.render('login');
});

newsroomRouter.get('/newsroom', requireSession, (req, res) => {
  res.render('newsroom');
});

newsroomRouter.get('/newsroom/review', requireSession, requireEditorArea, (req, res) => {
  res.render('newsroom-review');
});

newsroomRouter.get('/newsroom/analytics', requireSession, requireEditorArea, (req, res) => {
  res.render('newsroom-analytics');
});

// Placeholder until P3 mounts the public home page; /login already sends signed-in users to their area.
newsroomRouter.get('/', (req, res) => res.redirect('/login'));
