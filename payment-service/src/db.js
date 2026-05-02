'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paymentdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      transaction_ref VARCHAR(100) UNIQUE NOT NULL,
      order_id INT NOT NULL,
      user_id INT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      status VARCHAR(30) DEFAULT 'initiated',
      payment_method VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Payment DB initialised');
}

module.exports = { pool, initDb };
