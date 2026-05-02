'use strict';

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { initDb } = require('./db');
const inventoryRoutes = require('./routes/inventoryRoutes');

const app = express();
const PORT = process.env.PORT || 8006;

app.use(express.json());
app.use(morgan('combined'));
app.use('/api/inventory', inventoryRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'inventory-service' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Inventory service running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
