import express from 'express';
import { Usage } from '../models/index.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /api/usage - return per-bot usage for the authenticated user
router.get('/', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const records = await Usage.findAll({
      where: { userId: user.id },
      order: [['lastUsedAt', 'DESC']]
    });
    res.json({ usage: records });
  } catch (err) {
    console.error('❌ Usage fetch error:', err);
    res.status(500).json({ error: 'Unable to fetch usage.' });
  }
});

export default router;
