import express from 'express';
import db from '../db.js';
import { requireAuthenticatedUser } from '../middleware/auth.js';
import { normalizePhone, validatePhone } from '../middleware/validation.js';

const router = express.Router();

// Sync user on Google Sign-In
router.post('/sync', requireAuthenticatedUser, (req, res) => {
  const { uid: id, email = '', name = '' } = req.user;

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)')
      .run(id, email, name || 'Community Guardian');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ success: true, user });
});

// Update display name
router.post('/update-name', requireAuthenticatedUser, (req, res) => {
  const { displayName } = req.body;
  const userId = req.user.uid;
  const name = (displayName || '').trim().slice(0, 40) || 'Community Guardian';
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id, display_name) VALUES (?, ?)').run(userId, name);
  } else {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, userId);
  }
  res.json({ success: true, displayName: name });
});

// Update Emergency Contact
router.post('/emergency-contact', requireAuthenticatedUser, (req, res) => {
  const { phone } = req.body;
  const userId = req.user.uid;
  if (!validatePhone(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number with country code, for example +919876543210.' });
  }
  const normalizedPhone = normalizePhone(phone);

  // Ensure user exists
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id, emergency_contact) VALUES (?, ?)').run(userId, normalizedPhone);
  } else {
    db.prepare('UPDATE users SET emergency_contact = ? WHERE id = ?').run(normalizedPhone, userId);
  }

  res.json({ success: true, phone: normalizedPhone });
});

// Get Emergency Contact
router.get('/emergency-contact/:userId', requireAuthenticatedUser, (req, res) => {
  if (req.params.userId !== req.user.uid) return res.status(403).json({ error: 'Not authorized.' });
  const userId = req.user.uid;
  const user = db.prepare('SELECT emergency_contact FROM users WHERE id = ?').get(userId);
  res.json({ success: true, phone: user ? user.emergency_contact : null });
});

export default router;
