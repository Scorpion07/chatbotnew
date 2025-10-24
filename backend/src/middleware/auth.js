import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { User } from '../models/index.js';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Load fresh user from DB to ensure up-to-date premium flag
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.auth = { email: user.email };
    req.user = user; // attach full user model instance
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export function premiumRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.user.isPremium) return res.status(403).json({ error: 'Premium required' });
  next();
}
