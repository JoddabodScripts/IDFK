const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const dotenv = require('dotenv');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
  console.log('Auto-generated JWT_SECRET:', process.env.JWT_SECRET);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', require('./routes/auth'));
app.use('/boards', require('./routes/boards'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});