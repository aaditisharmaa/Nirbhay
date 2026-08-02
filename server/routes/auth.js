import express from 'express';
import db from '../db.js';

const router = express.Router();

// Sync user on Google Sign-In
router.post('/sync', (req, res) => {
  const { id, email, displayName } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)')
      .run(id, email || '', displayName || 'Anonymous User');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ success: true, user });
});

// Update Emergency Contact
router.post('/emergency-contact', (req, res) => {
  const { userId, phone } = req.body;
  if (!userId || !phone) {
    return res.status(400).json({ error: 'userId and phone are required' });
  }

  // Ensure user exists
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id, emergency_contact) VALUES (?, ?)').run(userId, phone);
  } else {
    db.prepare('UPDATE users SET emergency_contact = ? WHERE id = ?').run(phone, userId);
  }

  res.json({ success: true, phone });
});

// Get Emergency Contact
router.get('/emergency-contact/:userId', (req, res) => {
  const { userId } = req.params;
  const user = db.prepare('SELECT emergency_contact FROM users WHERE id = ?').get(userId);
  res.json({ success: true, phone: user ? user.emergency_contact : null });
});

export default router;
