import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scrypt = promisify(scryptCb);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'sportshub_session';
const loginAttempts = new Map();

export function hashOpaque(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
    throw new Error('Password must be between 12 and 200 characters.');
  }
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, saltHex, keyHex] = String(encoded).split(':');
  if (scheme !== 'scrypt' || !/^[0-9a-f]{32}$/.test(saltHex || '') || !/^[0-9a-f]{128}$/.test(keyHex || '')) return false;
  const candidate = Buffer.from(await scrypt(String(password), Buffer.from(saltHex, 'hex'), 64));
  return timingSafeEqual(candidate, Buffer.from(keyHex, 'hex'));
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return i < 0 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
  }));
}

export function setSessionCookie(res, token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export function createSession(userId) {
  db.prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')").run();
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_MS).toISOString();
  db.prepare('INSERT INTO sessions (id_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)')
    .run(hashOpaque(token), userId, csrfToken, expires);
  return { token, csrfToken, maxAge: Math.floor(SESSION_MS / 1000) };
}

export function getSession(req) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token || token.length > 100) return null;
  const row = db.prepare(`SELECT s.csrf_token,u.id,u.email,u.display_name,u.role,u.sports_interests
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id_hash=? AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`).get(hashOpaque(token));
  return row ? { ...row, token } : null;
}

export function destroySession(session) {
  if (session) db.prepare('DELETE FROM sessions WHERE id_hash=?').run(hashOpaque(session.token));
}

export function requireCsrf(req, session) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { return false; }
    if (parsed.host !== host) return false;
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') return false;
  }
  const supplied = Buffer.from(String(req.headers['x-csrf-token'] || ''));
  const expected = Buffer.from(session?.csrf_token || '');
  return Boolean(session && supplied.length === expected.length && timingSafeEqual(supplied, expected));
}

export function allowLoginAttempt(key) {
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
  if (recent.length >= 10) return false;
  recent.push(now);
  loginAttempts.set(key, recent);
  if (loginAttempts.size > 5000) {
    for (const [k, entries] of loginAttempts) if (entries.at(-1) < now - 15 * 60 * 1000) loginAttempts.delete(k);
  }
  return true;
}

export function newId() { return randomUUID(); }
export function safeUser(row) {
  if (!row) return null;
  let interests = [];
  try { interests = JSON.parse(row.sports_interests || '[]'); } catch {}
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, sportsInterests: interests };
}
