import express from 'express';
import { CreditCard, User } from '../models/index.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = express.Router();

// Save a new credit card (user endpoint)
router.post('/save', authRequired, async (req, res) => {
  try {
    const { cardName, cardNumber, cardType, expiryMonth, expiryYear } = req.body;
    
    if (!cardName || !cardNumber || !expiryMonth || !expiryYear) {
      return res.status(400).json({ error: 'All card fields are required' });
    }
    
    // Extract last 4 digits only for storage (security)
    const cardNumberLast4 = cardNumber.replace(/\s+/g, '').slice(-4);
    
    const creditCard = await CreditCard.create({
      userId: req.user.id,
      cardName,
      cardNumberLast4,
      cardType: cardType || 'Card',
      expiryMonth,
      expiryYear
    });
    
    res.json({ 
      success: true, 
      message: 'Credit card saved successfully',
      card: {
        id: creditCard.id,
        cardName: creditCard.cardName,
        last4: creditCard.cardNumberLast4,
        cardType: creditCard.cardType,
        expiry: `${creditCard.expiryMonth}/${creditCard.expiryYear}`
      }
    });
  } catch (err) {
    console.error('❌ Save credit card error:', err);
    res.status(500).json({ error: 'Failed to save credit card' });
  }
});

// Get all credit cards for current user
router.get('/my-cards', authRequired, async (req, res) => {
  try {
    const cards = await CreditCard.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ 
      cards: cards.map(card => ({
        id: card.id,
        cardName: card.cardName,
        last4: card.cardNumberLast4,
        cardType: card.cardType,
        expiry: `${card.expiryMonth}/${card.expiryYear}`,
        createdAt: card.createdAt
      }))
    });
  } catch (err) {
    console.error('❌ Get user cards error:', err);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Admin: Get all credit cards from all users
router.get('/all', authRequired, adminRequired, async (req, res) => {
  try {
    const cards = await CreditCard.findAll({
      include: [{
        model: User,
        attributes: ['id', 'email', 'name']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ 
      cards: cards.map(card => ({
        id: card.id,
        userId: card.userId,
        userEmail: card.User?.email,
        userName: card.User?.name,
        cardName: card.cardName,
        last4: card.cardNumberLast4,
        cardType: card.cardType,
        expiry: `${card.expiryMonth}/${card.expiryYear}`,
        createdAt: card.createdAt
      }))
    });
  } catch (err) {
    console.error('❌ Get all cards error:', err);
    res.status(500).json({ error: 'Failed to fetch all cards' });
  }
});

// Delete a credit card
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const card = await CreditCard.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id 
      }
    });
    
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    await card.destroy();
    res.json({ success: true, message: 'Card deleted successfully' });
  } catch (err) {
    console.error('❌ Delete card error:', err);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

export default router;
