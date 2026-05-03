'use strict';

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const productRoutes = require('./routes/productRoutes');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 8002;

app.use(express.json());
app.use(morgan('combined'));

app.use('/api/products', productRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service' });
});

/**
 * SECURITY FIX:
 * - Do not expose stack traces to client
 * - Avoid leaking internal structure
 */
app.use((err, req, res, next) => {
  console.error("Product service error logged internally");

  res.status(500).json({
    error: 'Internal server error'
  });
});

/**
 * SECURITY + RELIABILITY FIX:
 * - Ensure DB is ready before server starts
 * - Prevent partial initialization issues
 */
Promise.all([initDb()])
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Product service running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('Product service startup failed');
    process.exit(1);
  });