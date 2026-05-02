'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'orderdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      total_amount NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      product_id INT NOT NULL,
      product_name VARCHAR(200),
      quantity INT NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(10,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL CHECK (quantity > 0),
      added_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    );
  `);
  console.log('Order DB initialised');
}

module.exports = { pool, initDb };
