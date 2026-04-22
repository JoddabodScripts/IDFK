const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Self-ping every 5 seconds for Render
const BASE = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
  fetch(`${BASE}/health`).catch(() => {});
}, 5000);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/boards', require('./routes/boards'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { prisma };
