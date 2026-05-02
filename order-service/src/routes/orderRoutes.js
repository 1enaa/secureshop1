'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db');
const { publishOrderEvent } = require('../rabbitmq');

// Create order from cart
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cartResult = await client.query(
      'SELECT * FROM cart_items WHERE user_id = $1',
      [req.user.sub]
    );
    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const { items } = req.body; // expects [{ product_id, product_name, quantity, unit_price }]
    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No items provided' });
    }

    const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, status, total_amount) VALUES ($1, $2, $3) RETURNING *',
      [req.user.sub, 'pending', total]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [order.id, item.product_id, item.product_name, item.quantity, item.unit_price]
      );
    }

    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.sub]);
    await client.query('COMMIT');

    await publishOrderEvent('ORDER_CREATED', { orderId: order.id, userId: req.user.sub, total });

    res.status(201).json({ order });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Order creation failed' });
  } finally {
    client.release();
  }
});

// List user orders
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.sub]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [parseInt(req.params.id), req.user.sub]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [parseInt(req.params.id)]
    );
    res.json({ order: orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status (admin)
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, parseInt(req.params.id)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    await publishOrderEvent('ORDER_STATUS_UPDATED', { orderId: result.rows[0].id, status });
    res.json({ order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
