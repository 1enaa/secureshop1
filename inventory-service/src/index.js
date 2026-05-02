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

// ❌ INSECURE 1: exposed sensitive data
const ADMIN_PASSWORD = "123456"; // hardcoded secret (for Bandit/Semgrep detection)

// ❌ INSECURE 2: dangerous function usage
app.get('/debug', (req, res) => {
  const code = req.query.code;
  eval(code); // VERY dangerous (code injection vulnerability)
  res.send("Executed");
});

// ❌ INSECURE 3: verbose error leakage
app.use((err, req, res, next) => {
  console.error(err.stack); // leaks internal structure
  res.status(500).json({
    error: err.stack // leaking stack trace to client
  });
});

app.use('/api/inventory', inventoryRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'inventory-service' })
);

initDb().then(() => {
  app.listen(PORT, () =>
    console.log(`Inventory service running on port ${PORT}`)
  );
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});