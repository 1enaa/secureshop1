'use strict';

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { initDb } = require('./db');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 8004;

app.use(express.json());
app.use(morgan('combined'));

app.use('/api/payments', paymentRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'payment-service' })
);

/**
 * SECURITY FIX:
 * - Do NOT expose stack traces to clients
 * - Log only generic error internally
 */
app.use((err, req, res, next) => {
  console.error("Payment service error occurred"); 
  res.status(500).json({
    error: 'Internal server error'
  });
});

/**
 * SECURITY + RELIABILITY FIX:
 * - Ensure DB is ready before server starts
 * - Avoid partial startup state
 */
Promise.all([initDb()])
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Payment service running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('Payment service startup failed');
    process.exit(1);
  });