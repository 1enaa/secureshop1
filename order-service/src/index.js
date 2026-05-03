'use strict';

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { initDb } = require('./db');
const { connectRabbitMQ } = require('./rabbitmq');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');

const app = express();
const PORT = process.env.PORT || 8003;

app.use(express.json());
app.use(morgan('combined'));

app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'order-service' })
);

// ❌ FIX: safe error handling
app.use((err, req, res, next) => {
  console.error("Error logged internally");
  res.status(500).json({ error: 'Internal server error' });
});

Promise.all([initDb(), connectRabbitMQ()])
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Order service running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('Startup failed');
    process.exit(1);
  });