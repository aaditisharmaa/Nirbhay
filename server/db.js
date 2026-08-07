import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Env vars must be loaded before any other module reads process.env.
// ES module imports are hoisted, so db.js may run before app.js calls dotenv.config().
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

try {
  const Database = (await import('better-sqlite3')).default;
  // In production, prefer DATABASE_PATH env var (set via Render dashboard or render.yaml).
  // Fall back to the Render persistent disk default mount path if not explicitly set.
  const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : process.env.NODE_ENV === 'production'
      ? '/var/data/nirbhay.db'
      : path.join(__dirname, '../data/nirbhay.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      emergency_contact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      zone_id TEXT,
      confirm_count INTEGER DEFAULT 0,
      is_likely_spam INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upvotes (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(report_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS osm_signals (
      cell_id TEXT PRIMARY KEY,
      lat_center REAL,
      lng_center REAL,
      streetlight_count INTEGER DEFAULT 0,
      nearest_police_dist_km REAL DEFAULT 2.0,
      is_isolated INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      risk_level TEXT,
      recipient_phone TEXT,
      message_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Existing databases need this additive migration.
  try {
    db.exec('ALTER TABLE reports ADD COLUMN is_likely_spam INTEGER DEFAULT 0');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }
  console.log('⚡ SQLite Database initialized successfully at:', dbPath);

} catch (err) {
  if (process.env.NODE_ENV === 'production') throw err;
  console.warn('⚠️ SQLite native module unavailable, using in-memory JS fallback store:', err.message);

  // Resilient In-Memory DB Fallback
  const memoryStore = {
    users: new Map(),
    reports: new Map(),
    upvotes: new Map(),
    sos_alerts: new Map()
  };

  db = {
    prepare(sql) {
      const sqlLower = sql.toLowerCase().trim();

      return {
        run(...args) {
          if (sqlLower.includes('insert into users')) {
            const [id, email, display_name] = args;
            memoryStore.users.set(id, { id, email, display_name, created_at: new Date().toISOString() });
          } else if (sqlLower.includes('update users set emergency_contact')) {
            const [phone, id] = args;
            const u = memoryStore.users.get(id) || { id };
            u.emergency_contact = phone;
            memoryStore.users.set(id, u);
          } else if (sqlLower.includes('insert into reports')) {
            const [id, user_id, lat, lng, category, severity, description, zone_id] = args;
            const hasConfirmCount = sqlLower.includes('confirm_count');
            const hasSpamFlag = sqlLower.includes('is_likely_spam');
            const confirm_count = hasConfirmCount ? args[8] : 0;
            const is_likely_spam = hasSpamFlag ? args[hasConfirmCount ? 9 : 8] : 0;
            const created_at = hasConfirmCount ? args[hasSpamFlag ? 10 : 9] : new Date().toISOString();
            memoryStore.reports.set(id, { id, user_id, lat, lng, category, severity, description, zone_id, confirm_count, is_likely_spam, created_at });
          } else if (sqlLower.includes('update reports set confirm_count')) {
            const [id] = args;
            const r = memoryStore.reports.get(id);
            if (r) r.confirm_count = (r.confirm_count || 0) + 1;
          } else if (sqlLower.includes('insert into upvotes')) {
            const [id, report_id, user_id] = args;
            if (memoryStore.upvotes.has(`${report_id}_${user_id}`)) throw new Error('UNIQUE constraint failed');
            memoryStore.upvotes.set(`${report_id}_${user_id}`, { id, report_id, user_id });
          } else if (sqlLower.includes('insert into sos_alerts')) {
            const [id, user_id, lat, lng, risk_level, recipient_phone, message_content] = args;
            memoryStore.sos_alerts.set(id, { id, user_id, lat, lng, risk_level, recipient_phone, message_content });
          }
          return { changes: 1 };
        },

        get(...args) {
          if (sqlLower.includes('select * from users where id')) {
            return memoryStore.users.get(args[0]) || null;
          } else if (sqlLower.includes('select emergency_contact from users')) {
            const u = memoryStore.users.get(args[0]);
            return u ? { emergency_contact: u.emergency_contact } : null;
          } else if (sqlLower.includes('select * from reports where id')) {
            return memoryStore.reports.get(args[0]) || null;
          } else if (sqlLower.includes('select count(*) as count from reports') || sqlLower.includes('select count(*) as cnt from reports')) {
            return { count: memoryStore.reports.size, cnt: memoryStore.reports.size };
          } else if (sqlLower.includes('select count(*) as count from sos_alerts')) {
            return { count: memoryStore.sos_alerts.size };
          }
          return null;
        },

        all() {
          if (sqlLower.includes('from reports')) {
            return Array.from(memoryStore.reports.values());
          } else if (sqlLower.includes('from upvotes')) {
            return Array.from(memoryStore.upvotes.values());
          } else if (sqlLower.includes('from users')) {
            return Array.from(memoryStore.users.values());
          }
          return [];
        }
      };
    }
  };
}

export default db;
