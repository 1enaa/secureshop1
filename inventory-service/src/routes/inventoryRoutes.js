'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

// Get stock level for a product
router.get('/:productId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventory WHERE product_id = $1',
      [parseInt(req.params.productId)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not in inventory' });
    const inv = result.rows[0];
    res.json({ ...inv, available_qty: inv.stock_qty - inv.reserved_qty });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Set stock level (admin)
router.put('/:productId', authenticate, requireAdmin, async (req, res) => {
  const { stock_qty } = req.body;
  if (typeof stock_qty !== 'number' || stock_qty < 0) {
    return res.status(400).json({ error: 'Invalid stock_qty' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO inventory (product_id, stock_qty)
       VALUES ($1, $2)
       ON CONFLICT (product_id) DO UPDATE SET stock_qty = $2, updated_at = NOW()
       RETURNING *`,
      [parseInt(req.params.productId), stock_qty]
    );
    res.json({ inventory: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Reserve stock
router.post('/reserve', authenticate, async (req, res) => {
  const { order_id, items } = req.body; // items: [{ product_id, quantity }]
  if (!order_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid reservation request' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const inv = await client.query(
        'SELECT stock_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE',
        [item.product_id]
      );
      if (inv.rows.length === 0) throw new Error(`Product ${item.product_id} not in inventory`);
      const { stock_qty, reserved_qty } = inv.rows[0];
      if (stock_qty - reserved_qty < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }
      await client.query(
        'UPDATE inventory SET reserved_qty = reserved_qty + $1, updated_at = NOW() WHERE product_id = $2',
        [item.quantity, item.product_id]
      );
      await client.query(
        'INSERT INTO reservations (order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [order_id, item.product_id, item.quantity]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Stock reserved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Release reservation
router.post('/release', authenticate, async (req, res) => {
  const { order_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reservations = await client.query(
      "SELECT * FROM reservations WHERE order_id = $1 AND status = 'active'",
      [order_id]
    );
    for (const r of reservations.rows) {
      await client.query(
        'UPDATE inventory SET reserved_qty = reserved_qty - $1, updated_at = NOW() WHERE product_id = $2',
        [r.quantity, r.product_id]
      );
      await client.query(
        "UPDATE reservations SET status = 'released' WHERE id = $1",
        [r.id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Reservation released' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to release reservation' });
  } finally {
    client.release();
  }
});

module.exports = router;
