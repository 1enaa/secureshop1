'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db');

// Get cart
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = $1 ORDER BY added_at',
      [req.user.sub]
    );
    res.json({ cart: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add/update cart item
router.post('/items', authenticate, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid product_id or quantity' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = EXCLUDED.quantity
       RETURNING *`,
      [req.user.sub, product_id, quantity]
    );
    res.json({ item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove cart item
router.delete('/items/:productId', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [req.user.sub, parseInt(req.params.productId)]
    );
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear cart
router.delete('/', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.sub]);
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
