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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Product service running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
