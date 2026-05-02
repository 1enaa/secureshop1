'use strict';

const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db');

// Initiate payment
router.post(
  '/initiate',
  authenticate,
  [
    body('order_id').isInt({ min: 1 }),
    body('amount').isFloat({ min: 0.01 }),
    body('payment_method').isIn(['card', 'paypal', 'bank_transfer']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { order_id, amount, payment_method, currency = 'USD' } = req.body;
    const transaction_ref = uuidv4();

    try {
      // Simulate payment processing (in production, call real payment gateway)
      const paymentSuccess = Math.random() > 0.1; // 90% success simulation

      const status = paymentSuccess ? 'completed' : 'failed';

      const result = await pool.query(
        `INSERT INTO transactions (transaction_ref, order_id, user_id, amount, currency, status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [transaction_ref, order_id, req.user.sub, amount, currency, status, payment_method]
      );

      const httpStatus = paymentSuccess ? 201 : 402;
      res.status(httpStatus).json({
        transaction: result.rows[0],
        message: paymentSuccess ? 'Payment successful' : 'Payment failed',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Payment processing failed' });
    }
  }
);

// Get transaction by ref
router.get('/:ref', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE transaction_ref = $1 AND user_id = $2',
      [req.params.ref, req.user.sub]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// List user transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.sub]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
