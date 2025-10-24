import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';
import { User } from '../models/index.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const usersPath = path.join(process.cwd(), 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function readUsers() {
  if (!fs.existsSync(usersPath)) return [];
  return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
}
function writeUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// Signup (DB-backed)
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already exists.' });
  const hash = await bcrypt.hash(password, 10);
  await User.create({ email, password: hash, isPremium: false });
  res.json({ success: true });
});

// Login (DB-backed)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials.' });
  const token = jwt.sign({ email, isPremium: user.isPremium }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, isPremium: user.isPremium });
});

// Upgrade to premium (placeholder for payment gateway)
router.post('/subscribe', async (req, res) => {
  // Expect Authorization: Bearer <token>
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    
    // TODO: In production, this endpoint should only be called by your payment gateway webhook
    // after verifying the payment succeeded. For now, it's a placeholder.
    // Real flow:
    // 1. User clicks "Proceed to Payment" on frontend
    // 2. Frontend calls POST /api/payment/create-session to get checkout URL
    // 3. User completes payment on gateway (Stripe/Razorpay/etc.)
    // 4. Gateway calls POST /api/payment/webhook with payment confirmation
    // 5. Webhook handler verifies signature and calls this logic to set isPremium = true
    
    user.isPremium = true;
    await user.save();
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

// Get user info
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ email: user.email, isPremium: user.isPremium });
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

export default router;
