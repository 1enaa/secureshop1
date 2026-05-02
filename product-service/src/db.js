'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'productdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
      category_id INT REFERENCES categories(id),
      sku VARCHAR(100) UNIQUE NOT NULL,
      stock_qty INT DEFAULT 0 CHECK (stock_qty >= 0),
      created_at TIMESTAMP DEFAULT NOW()
    );

    INSERT INTO categories (name, description)
    VALUES ('Electronics', 'Electronic gadgets and devices'),
           ('Clothing', 'Apparel and accessories')
    ON CONFLICT (name) DO NOTHING;
  `);
  console.log('Product DB initialised');
}

module.exports = { pool, initDb };
