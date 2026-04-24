const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../lib/firebase');
const auth = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    
    const usersRef = db.collection('users');
    const existing = await usersRef.where('email', '==', email).limit(1).get();
    
    if (!existing.empty) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRef = usersRef.doc();
    await userRef.set({
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });
    
    const token = jwt.sign({ id: userRef.id }, process.env.JWT_SECRET || 'secret');
    res.json({ token, user: { id: userRef.id, email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };
    
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret');
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

module.exports = router;