import express from 'express';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { User } from '../models/index.js';

const router = express.Router();

// Set or unset premium for a user by email
router.post('/users/premium', authRequired, adminRequired, async (req, res) => {
  try {
    const { email, isPremium } = req.body || {};
    if (!email || typeof isPremium !== 'boolean') {
      return res.status(400).json({ message: 'email and isPremium(boolean) are required' });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isPremium = isPremium;
    await user.save();
    return res.json({ ok: true, user: { id: user.id, email: user.email, isPremium: user.isPremium } });
  } catch (e) {
    console.error('Admin set premium error:', e.message);
    return res.status(500).json({ message: 'Failed to update user' });
  }
});

export default router;
