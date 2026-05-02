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

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  connectRabbitMQ();
  app.listen(PORT, () => console.log(`Order service running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
