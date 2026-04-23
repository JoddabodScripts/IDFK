const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
require('dotenv').config();

dotenv.config();

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