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

// Update Emergency Contacts (up to 3)
router.post('/emergency-contact', requireAuthenticatedUser, (req, res) => {
  const { phone, phones } = req.body;
  const userId = req.user.uid;

  // Accept either a single `phone` (legacy) or an array `phones`
  const rawList = phones ?? (phone ? [phone] : []);
  const validated = rawList
    .map(p => (p || '').trim())
    .filter(p => p.length > 0)
    .map(p => normalizePhone(p))
    .filter(p => validatePhone(p))
    .slice(0, 3); // max 3

  if (validated.length === 0) {
    return res.status(400).json({ error: 'Enter at least one valid phone number with country code, e.g. +919876543210.' });
  }

  const contactsJson = JSON.stringify(validated);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id, emergency_contact, emergency_contacts) VALUES (?, ?, ?)')
      .run(userId, validated[0], contactsJson);
  } else {
    db.prepare('UPDATE users SET emergency_contact = ?, emergency_contacts = ? WHERE id = ?')
      .run(validated[0], contactsJson, userId);
  }

  res.json({ success: true, phones: validated, phone: validated[0] });
});

// Get Emergency Contacts
router.get('/emergency-contact/:userId', requireAuthenticatedUser, (req, res) => {
  if (req.params.userId !== req.user.uid) return res.status(403).json({ error: 'Not authorized.' });
  const user = db.prepare('SELECT emergency_contact, emergency_contacts FROM users WHERE id = ?').get(req.user.uid);
  if (!user) return res.json({ success: true, phone: null, phones: [] });

  let phones = [];
  try { phones = user.emergency_contacts ? JSON.parse(user.emergency_contacts) : []; }
  catch (_) { phones = user.emergency_contact ? [user.emergency_contact] : []; }

  res.json({ success: true, phone: phones[0] ?? null, phones });
});

export default router;
