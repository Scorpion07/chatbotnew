
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Load fresh user from DB using id from JWT
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.auth = { id: user.id, email: user.email };
    req.user = user; // attach full user model instance
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export function premiumRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.user.isPremium) return res.status(403).json({ error: 'Premium required' });
  next();
}

export function adminRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin required' });
  next();
}
