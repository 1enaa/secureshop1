'use strict';

const { validationResult } = require('express-validator');
const { pool } = require('../db');

exports.listProducts = async (req, res) => {
  try {
    const { category_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let queryStr = 'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
    const params = [];
    if (category_id) {
      params.push(parseInt(category_id));
      queryStr += ` WHERE p.category_id = $${params.length}`;
    }
    queryStr += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(queryStr, params);
    res.json({ products: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list products' });
  }
};

exports.searchProducts = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { q } = req.query;
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.name ILIKE $1 OR p.description ILIKE $1`,
      [`%${q}%`]
    );
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1',
      [parseInt(req.params.id)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

exports.listCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list categories' });
  }
};

exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description, price, category_id, sku, stock_qty } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, category_id, sku, stock_qty) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, description, price, category_id, sku, stock_qty || 0]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: 'Failed to create product' });
  }
};

exports.updateProduct = async (req, res) => {
  const { name, description, price, category_id, stock_qty } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name=$1, description=$2, price=$3, category_id=$4, stock_qty=$5 WHERE id=$6 RETURNING *',
      [name, description, price, category_id, stock_qty, parseInt(req.params.id)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [parseInt(req.params.id)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};
