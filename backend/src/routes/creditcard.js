import express from 'express';
import { CreditCard, User } from '../models/index.js';
import { adminRequired } from '../middleware/auth.js';

const router = express.Router();

// Save a new credit card (no auth required)
router.post('/save', async (req, res) => {
  try {
    const { cardName, cardNumber, cardType, expiryMonth, expiryYear, cvv, userEmail } = req.body;
    
    if (!cardName || !cardNumber || !expiryMonth || !expiryYear || !cvv) {
      return res.status(400).json({ error: 'All card fields are required' });
    }
    
    // Find or create user by email if provided
    let userId = null;
    if (userEmail) {
      const user = await User.findOne({ where: { email: userEmail } });
      if (user) userId = user.id;
    }
    
    const creditCard = await CreditCard.create({
      userId,
      cardName,
      cardNumber: cardNumber.replace(/\s+/g, ''),
      cardType: cardType || 'Card',
      expiryMonth,
      expiryYear,
      cvv
    });
    
    res.json({ 
      success: true, 
      message: 'Credit card saved successfully',
      card: {
        id: creditCard.id,
        cardName: creditCard.cardName,
        cardNumber: creditCard.cardNumber,
        cardType: creditCard.cardType,
        expiry: `${creditCard.expiryMonth}/${creditCard.expiryYear}`,
        cvv: creditCard.cvv
      }
    });
  } catch (err) {
    console.error('❌ Save credit card error:', err);
    res.status(500).json({ error: 'Failed to save credit card' });
  }
});



// Admin: Get all credit cards from all users (admin access only)
router.get('/all', adminRequired, async (req, res) => {
  try {
    const cards = await CreditCard.findAll({
      include: [{
        model: User,
        attributes: ['id', 'email', 'name'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ 
      cards: cards.map(card => ({
        id: card.id,
        userId: card.userId,
        userEmail: card.User?.email || 'N/A',
        userName: card.User?.name || 'N/A',
        cardName: card.cardName,
        cardNumber: card.cardNumber,
        cardType: card.cardType,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        cvv: card.cvv,
        createdAt: card.createdAt
      }))
    });
  } catch (err) {
    console.error('❌ Get all cards error:', err);
    res.status(500).json({ error: 'Failed to fetch all cards' });
  }
});

// Delete a credit card (admin only)
router.delete('/:id', adminRequired, async (req, res) => {
  try {
    const card = await CreditCard.findOne({
      where: { id: req.params.id }
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
