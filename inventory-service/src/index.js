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

// ✅ FIX 1: no hardcoded secrets
// ADMIN_PASSWORD moved to .env
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Optional safety check
if (!ADMIN_PASSWORD) {
  console.warn("WARNING: ADMIN_PASSWORD is not set in environment variables");
}

// ❌ FIX 2: remove eval completely (replaced with safe logic)
app.get('/debug', (req, res) => {
  // Instead of executing code, just return input safely
  const code = req.query.code;

  res.json({
    message: "Debug endpoint disabled for security",
    received: code || null
  });
});

// ❌ FIX 3: no stack trace exposure
app.use((err, req, res, next) => {
  console.error(err); // log internally only

  res.status(500).json({
    error: "Internal Server Error"
  });
});

app.use('/api/inventory', inventoryRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'inventory-service' })
);

initDb()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Inventory service running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
  });