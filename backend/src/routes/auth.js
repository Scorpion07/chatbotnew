import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';
import { User } from '../models/index.js';
import { authConfig, getConfig } from '../services/configService.js';

const router = express.Router();
const usersPath = path.join(process.cwd(), 'users.json');

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
  // Use bcrypt rounds from config
  const hash = await bcrypt.hash(password, authConfig.bcryptRounds);
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
  const token = jwt.sign({ email, isPremium: user.isPremium }, authConfig.jwtSecret, { expiresIn: authConfig.tokenExpiry });
  res.json({ token, isPremium: user.isPremium });
});

// Upgrade to premium (placeholder for payment gateway)
router.post('/subscribe', async (req, res) => {
  // Expect Authorization: Bearer <token>
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token.' });
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret);
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

// Google OAuth endpoint
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Google credential required' });
    }

    // Decode Google JWT token (basic verification)
    const base64Payload = credential.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    // Verify token is from Google and not expired
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      return res.status(400).json({ error: 'Invalid Google token issuer' });
    }
    
    if (payload.exp < Date.now() / 1000) {
      return res.status(400).json({ error: 'Google token expired' });
    }

    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ where: { email } });
    
    if (user) {
      // Update existing user with Google info if not already set
      if (!user.googleId) {
        await user.update({
          googleId,
          name: name || user.name,
          avatar: picture || user.avatar,
          provider: 'google'
        });
      }
    } else {
      // Create new user
      user = await User.create({
        email,
        googleId,
        name,
        avatar: picture,
        provider: 'google',
        isPremium: false
      });
    }

    // Generate JWT token
    const token = jwt.sign({ email: user.email, id: user.id }, authConfig.jwtSecret, { expiresIn: authConfig.tokenExpiry });
    
    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isPremium: user.isPremium,
        provider: user.provider
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Get user info
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token.' });
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ 
      email: user.email, 
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      isPremium: user.isPremium 
    });
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

export default router;
