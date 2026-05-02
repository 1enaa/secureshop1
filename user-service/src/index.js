'use strict';

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const userRoutes = require('./routes/userRoutes');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 8001;

app.use(express.json());
app.use(morgan('combined'));

app.use('/api/users', userRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`User service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialise DB:', err);
  process.exit(1);
});
