import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { authConfig } from '../services/configService.js';

const router = express.Router();

/* ============================================================
   SIGNUP (Email/Password)
   ============================================================ */
router.post('/signup', async (req, res) => {
  const start = Date.now();
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(409).json({ error: 'Email already exists.' });

    const hash = await bcrypt.hash(password, authConfig.bcryptRounds || 10);
    await User.create({ email, password: hash, isPremium: false });

    console.log(`[Signup] Created user: ${email} in ${Date.now() - start}ms`);
    res.json({ success: true });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   LOGIN (Email/Password)
   ============================================================ */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.password)
      return res.status(401).json({ error: 'Account uses Google Sign-In.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign(
      { email, isPremium: user.isPremium },
      authConfig.jwtSecret,
      { expiresIn: authConfig.tokenExpiry || '7d' }
    );

    res.json({ token, isPremium: user.isPremium });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   SUBSCRIBE (Premium upgrade)
   ============================================================ */
router.post('/subscribe', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token.' });

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret);
    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.isPremium = true;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(401).json({ error: 'Invalid token.' });
  }
});

/* ============================================================
   GOOGLE OAUTH (JWT payload verification)
   ============================================================ */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ error: 'Google credential required' });

    const base64Payload = credential.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com')
      return res.status(400).json({ error: 'Invalid Google token issuer' });

    if (payload.exp < Date.now() / 1000)
      return res.status(400).json({ error: 'Google token expired' });

    const { email, name, picture, sub: googleId } = payload;

    let user = await User.findOne({ where: { email } });
    if (user) {
      if (!user.googleId) {
        await user.update({
          googleId,
          name: name || user.name,
          avatar: picture || user.avatar,
          provider: 'google'
        });
      }
    } else {
      user = await User.create({
        email,
        googleId,
        name,
        avatar: picture,
        provider: 'google',
        isPremium: false
      });
    }

    const token = jwt.sign(
      { email: user.email, id: user.id },
      authConfig.jwtSecret,
      { expiresIn: authConfig.tokenExpiry || '7d' }
    );

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

/* ============================================================
   GET CURRENT USER INFO
   ============================================================ */
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
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(401).json({ error: 'Invalid token.' });
  }
});

export default router;
