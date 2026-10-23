import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = resolve(process.env.DATABASE_PATH || './data/sportshub.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true, timeout: 5000 });
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  sports_interests TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sport TEXT NOT NULL,
  event_type TEXT NOT NULL,
  organizer TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  location_unavailable INTEGER NOT NULL DEFAULT 0 CHECK(location_unavailable IN (0,1)),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  registration_opens_at TEXT,
  registration_closes_at TEXT,
  participant_capacity INTEGER NOT NULL DEFAULT 0 CHECK(participant_capacity >= 0),
  spectator_capacity INTEGER NOT NULL DEFAULT 0 CHECK(spectator_capacity >= 0),
  participant_policy TEXT NOT NULL DEFAULT 'automatic' CHECK(participant_policy IN ('automatic','review')),
  spectator_policy TEXT NOT NULL DEFAULT 'automatic' CHECK(spectator_policy IN ('automatic','review')),
  participant_enabled INTEGER NOT NULL DEFAULT 1 CHECK(participant_enabled IN (0,1)),
  spectator_enabled INTEGER NOT NULL DEFAULT 0 CHECK(spectator_enabled IN (0,1)),
  eligibility TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled','archived')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS events_public_schedule_idx ON events(status, starts_at);
CREATE INDEX IF NOT EXISTS events_sport_idx ON events(sport, event_type);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_type TEXT NOT NULL CHECK(booking_type IN ('participant','spectator')),
  status TEXT NOT NULL CHECK(status IN ('pending','confirmed','rejected','cancelled')),
  decision_note TEXT NOT NULL DEFAULT '',
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(event_id, user_id, booking_type)
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS bookings_event_idx ON bookings(event_id, status, booking_type);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

const eventColumns = new Set(db.prepare('PRAGMA table_info(events)').all().map(column => column.name));
if (!eventColumns.has('location_unavailable')) db.exec('ALTER TABLE events ADD COLUMN location_unavailable INTEGER NOT NULL DEFAULT 0');

export function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function cleanupExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')").run();
}
