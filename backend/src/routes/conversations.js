import express from 'express';
import { Conversation, Message } from '../models/index.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// List conversations for current user
router.get('/', authRequired, async (req, res) => {
  try {
    const items = await Conversation.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']],
      attributes: ['id', 'title', 'botName', 'createdAt', 'updatedAt']
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// Create a new conversation
router.post('/', authRequired, async (req, res) => {
  try {
    const { title = null, botName = null } = req.body || {};
    const conv = await Conversation.create({ userId: req.user.id, title, botName });
    res.json(conv);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a conversation
router.get('/:id', authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const conv = await Conversation.findOne({ where: { id, userId: req.user.id } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const messages = await Message.findAll({ where: { conversationId: id }, order: [['createdAt', 'ASC']] });
    res.json({ conversation: conv, messages });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Delete a conversation (and its messages via cascade)
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await Conversation.destroy({ where: { id, userId: req.user.id } });
    if (!deleted) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
