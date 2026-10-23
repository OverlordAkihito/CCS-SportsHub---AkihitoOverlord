import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { db, transaction, cleanupExpiredSessions } from './db.js';
import { allowLoginAttempt, clearSessionCookie, createSession, destroySession, getSession, hashPassword, newId, requireCsrf, safeUser, setSessionCookie, verifyPassword } from './auth.js';

const root = resolve('public');
const port = Number(process.env.PORT || 3000);
const typeConfig = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function fail(res, status, code, message) { sendJson(res, status, { error: { code, message } }); }
function jsonBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 64 * 1024) { reject(Object.assign(new Error('Request body is too large.'), { status: 413 })); req.destroy(); }
    });
    req.on('end', () => {
      if (!body) return resolveBody({});
      try { resolveBody(JSON.parse(body)); } catch { reject(Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function requiredSession(req, res) {
  const session = getSession(req);
  if (!session) { fail(res, 401, 'AUTH_REQUIRED', 'Sign in to continue.'); return null; }
  return session;
}
function adminSession(req, res) {
  const session = requiredSession(req, res);
  if (!session) return null;
  if (session.role !== 'admin') { fail(res, 403, 'FORBIDDEN', 'Administrator access is required.'); return null; }
  return session;
}
function csrf(req, res, session) {
  if (!requireCsrf(req, session)) { fail(res, 403, 'CSRF_REJECTED', 'The request could not be verified. Refresh and try again.'); return false; }
  return true;
}
function audit(actorId, action, type, entityId, details = {}) {
  db.prepare('INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)')
    .run(newId(), actorId, action, type, entityId, JSON.stringify(details));
}
function notify(userId, kind, message, eventId = null, bookingId = null) {
  db.prepare('INSERT INTO notifications(id,user_id,event_id,booking_id,kind,message) VALUES(?,?,?,?,?,?)')
    .run(newId(), userId, eventId, bookingId, kind, message);
}
function bookingCounts(eventId) {
  const rows = db.prepare(`SELECT booking_type, COUNT(*) count FROM bookings WHERE event_id=? AND status IN ('pending','confirmed') GROUP BY booking_type`).all(eventId);
  return Object.fromEntries(rows.map(row => [row.booking_type, Number(row.count)]));
}
function publicEvent(row) {
  if (!row) return null;
  const counts = bookingCounts(row.id);
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description, sport: row.sport, type: row.event_type,
    organizer: row.organizer, venue: row.venue, address: row.address, latitude: row.latitude, longitude: row.longitude,
    startsAt: row.starts_at, endsAt: row.ends_at, registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at, participantCapacity: row.participant_capacity,
    spectatorCapacity: row.spectator_capacity, participantPolicy: row.participant_policy, spectatorPolicy: row.spectator_policy,
    participantEnabled: Boolean(row.participant_enabled), spectatorEnabled: Boolean(row.spectator_enabled),
    locationUnavailable: Boolean(row.location_unavailable),
    eligibility: row.eligibility, instructions: row.instructions, status: row.status,
    participantCount: counts.participant || 0, spectatorCount: counts.spectator || 0
  };
}
function eventRowBySlug(slug) { return db.prepare('SELECT * FROM events WHERE slug=?').get(slug); }
function slugify(text) { return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70); }
function validateEvent(input) {
  const text = key => typeof input[key] === 'string' ? input[key].trim() : '';
  const title = text('title'), sport = text('sport'), type = text('eventType'), organizer = text('organizer'), venue = text('venue');
  const startsAt = text('startsAt'), endsAt = text('endsAt');
  const errors = {};
  if (title.length < 3 || title.length > 120) errors.title = 'Title must be 3 to 120 characters.';
  if (!sport || sport.length > 60) errors.sport = 'Choose a sport (up to 60 characters).';
  if (!type || type.length > 60) errors.eventType = 'Choose an event type.';
  if (!organizer || organizer.length > 120) errors.organizer = 'Enter an organizer.';
  if (!venue || venue.length > 160) errors.venue = 'Enter a venue or mark location unavailable.';
  if (!startsAt || Number.isNaN(Date.parse(startsAt)) || !endsAt || Number.isNaN(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) errors.schedule = 'Enter a valid start and end time.';
  for (const key of ['participantCapacity', 'spectatorCapacity']) {
    if (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > 100000) errors[key] = 'Capacity must be a whole number between 0 and 100000.';
  }
  const lat = input.latitude === '' || input.latitude == null ? null : Number(input.latitude);
  const lon = input.longitude === '' || input.longitude == null ? null : Number(input.longitude);
  if ((lat == null) !== (lon == null) || (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lon != null && (!Number.isFinite(lon) || lon < -180 || lon > 180))) errors.coordinates = 'Enter both valid latitude and longitude, or leave both blank.';
  if (!['automatic', 'review'].includes(input.participantPolicy)) errors.participantPolicy = 'Invalid participant policy.';
  if (!['automatic', 'review'].includes(input.spectatorPolicy)) errors.spectatorPolicy = 'Invalid spectator policy.';
  if (!['draft', 'published', 'cancelled', 'archived'].includes(input.status)) errors.status = 'Invalid event status.';
  if (input.registrationOpensAt && !Number.isFinite(Date.parse(input.registrationOpensAt))) errors.registrationOpensAt = 'Registration opening date is invalid.';
  if (input.registrationClosesAt && !Number.isFinite(Date.parse(input.registrationClosesAt))) errors.registrationClosesAt = 'Registration closing date is invalid.';
  if (input.registrationOpensAt && input.registrationClosesAt && Date.parse(input.registrationClosesAt) <= Date.parse(input.registrationOpensAt)) errors.registrationWindow = 'Registration must close after it opens.';
  if (input.registrationOpensAt && Date.parse(input.registrationOpensAt) >= Date.parse(startsAt)) errors.registrationOpensAt = 'Registration must open before the event starts.';
  if (input.registrationClosesAt && Date.parse(input.registrationClosesAt) > Date.parse(startsAt)) errors.registrationClosesAt = 'Registration must close before the event starts.';
  if (!input.participantEnabled && !input.spectatorEnabled && input.status === 'published') errors.registration = 'Enable at least one registration type before publishing.';
  if (input.status === 'published' && lat == null && !input.locationUnavailable) errors.location = 'Add verified coordinates or explicitly mark the location unavailable before publishing.';
  return { errors, values: { title, sport, eventType: type, organizer, venue, startsAt, endsAt,
    description: text('description').slice(0, 8000), address: text('address').slice(0, 300), eligibility: text('eligibility').slice(0, 2000),
    instructions: text('instructions').slice(0, 4000), latitude: lat, longitude: lon,
    registrationOpensAt: text('registrationOpensAt') || null, registrationClosesAt: text('registrationClosesAt') || null,
    participantCapacity: input.participantCapacity, spectatorCapacity: input.spectatorCapacity,
    participantPolicy: input.participantPolicy, spectatorPolicy: input.spectatorPolicy,
    participantEnabled: Boolean(input.participantEnabled), spectatorEnabled: Boolean(input.spectatorEnabled), locationUnavailable: Boolean(input.locationUnavailable), status: input.status } };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  if (method === 'GET' && path === '/api/health') return sendJson(res, 200, { ok: true, storage: 'sqlite' });
  if (method === 'GET' && path === '/api/events') {
    const search = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const sport = (url.searchParams.get('sport') || '').slice(0, 60);
    const type = (url.searchParams.get('type') || '').slice(0, 60);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const clauses = ["status='published'", "ends_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now')"];
    const params = [];
    if (search) { clauses.push('(title LIKE ? OR sport LIKE ? OR venue LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (sport) { clauses.push('sport=?'); params.push(sport); }
    if (type) { clauses.push('event_type=?'); params.push(type); }
    if (from && Number.isFinite(Date.parse(from))) { clauses.push('starts_at>=?'); params.push(new Date(from).toISOString()); }
    if (to && Number.isFinite(Date.parse(to))) { clauses.push('starts_at<=?'); params.push(new Date(to).toISOString()); }
    const rows = db.prepare(`SELECT * FROM events WHERE ${clauses.join(' AND ')} ORDER BY starts_at ASC LIMIT 100`).all(...params);
    return sendJson(res, 200, { events: rows.map(publicEvent), total: rows.length });
  }
  if (method === 'GET' && path.startsWith('/api/events/')) {
    const slug = decodeURIComponent(path.slice('/api/events/'.length));
    const row = eventRowBySlug(slug);
    const session = getSession(req);
    if (!row) return fail(res, 404, 'NOT_FOUND', 'Event not found.');
    const ownsBooking = session && db.prepare('SELECT 1 FROM bookings WHERE event_id=? AND user_id=? LIMIT 1').get(row.id, session.id);
    if (!row || (row.status !== 'published' && session?.role !== 'admin' && !ownsBooking)) return fail(res, 404, 'NOT_FOUND', 'Event not found.');
    return sendJson(res, 200, { event: publicEvent(row) });
  }
  if (method === 'GET' && path === '/api/session') {
    const session = getSession(req);
    return sendJson(res, 200, { user: safeUser(session), csrfToken: session?.csrf_token || null });
  }
  if (method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/login')) {
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'); }
      catch { return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'); }
    }
    const ip = req.socket.remoteAddress || 'unknown';
    if (!allowLoginAttempt(`${ip}:${path}`)) return fail(res, 429, 'RATE_LIMITED', 'Too many attempts. Wait 15 minutes and try again.');
    const body = await jsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail(res, 400, 'INVALID_EMAIL', 'Enter a valid email address.');
    let user;
    if (path.endsWith('register')) {
      const displayName = String(body.displayName || '').trim();
      if (displayName.length < 2 || displayName.length > 80) return fail(res, 400, 'INVALID_NAME', 'Name must be 2 to 80 characters.');
      if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return fail(res, 409, 'ACCOUNT_EXISTS', 'An account with that email already exists.');
      let passwordHash;
      try { passwordHash = await hashPassword(password); } catch (error) { return fail(res, 400, 'INVALID_PASSWORD', error.message); }
      const id = newId();
      try { db.prepare('INSERT INTO users(id,email,display_name,password_hash) VALUES(?,?,?,?)').run(id, email, displayName, passwordHash); }
      catch { return fail(res, 409, 'ACCOUNT_EXISTS', 'An account with that email already exists.'); }
      user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    } else {
      user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      const valid = user ? await verifyPassword(password, user.password_hash) : await verifyPassword(password || 'invalid', 'scrypt:00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000');
      if (!user || !valid) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const session = createSession(user.id);
    setSessionCookie(res, session.token, session.maxAge);
    return sendJson(res, path.endsWith('register') ? 201 : 200, { user: safeUser(user), csrfToken: session.csrfToken });
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    const session = requiredSession(req, res); if (!session) return;
    if (!csrf(req, res, session)) return;
    destroySession(session); clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }
  if (method === 'GET' && path === '/api/my/bookings') {
    const session = requiredSession(req, res); if (!session) return;
    const rows = db.prepare(`SELECT b.*,e.title,e.slug,e.sport,e.event_type,e.venue,e.starts_at,e.ends_at FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.user_id=? ORDER BY e.starts_at DESC LIMIT 200`).all(session.id);
    return sendJson(res, 200, { bookings: rows.map(row => ({ id: row.id, eventId: row.event_id, eventSlug: row.slug, title: row.title, sport: row.sport, eventType: row.event_type, venue: row.venue, startsAt: row.starts_at, endsAt: row.ends_at, type: row.booking_type, status: row.status, note: row.decision_note })) });
  }
  if (method === 'GET' && path === '/api/my/notifications') {
    const session = requiredSession(req, res); if (!session) return;
    const rows = db.prepare('SELECT id,event_id,booking_id,kind,message,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(session.id);
    return sendJson(res, 200, { notifications: rows });
  }
  if (method === 'POST' && path === '/api/my/profile') {
    const session = requiredSession(req, res); if (!session) return;
    if (!csrf(req, res, session)) return;
    const body = await jsonBody(req);
    const displayName = String(body.displayName || '').trim();
    const interests = Array.isArray(body.sportsInterests) ? [...new Set(body.sportsInterests.filter(x => typeof x === 'string').map(x => x.trim()).filter(x => x.length <= 40))].slice(0, 12) : [];
    if (displayName.length < 2 || displayName.length > 80) return fail(res, 400, 'INVALID_NAME', 'Name must be 2 to 80 characters.');
    db.prepare('UPDATE users SET display_name=?,sports_interests=? WHERE id=?').run(displayName, JSON.stringify(interests), session.id);
    return sendJson(res, 200, { user: safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(session.id)) });
  }
  const bookMatch = path.match(/^\/api\/events\/([^/]+)\/bookings$/);
  if (method === 'POST' && bookMatch) {
    const session = requiredSession(req, res); if (!session) return;
    if (!csrf(req, res, session)) return;
    const body = await jsonBody(req);
    if (!['participant', 'spectator'].includes(body.type)) return fail(res, 400, 'INVALID_BOOKING_TYPE', 'Choose participant registration or spectator reservation.');
    const row = eventRowBySlug(decodeURIComponent(bookMatch[1]));
    if (!row || row.status !== 'published') return fail(res, 404, 'NOT_BOOKABLE', 'This event is not accepting bookings.');
    try {
      const booking = transaction(() => {
        const event = db.prepare('SELECT * FROM events WHERE id=?').get(row.id);
        const type = body.type;
        if (type === 'participant' && !event.participant_enabled) throw Object.assign(new Error('Participant registration is not available.'), { code: 'TYPE_DISABLED' });
        if (type === 'spectator' && !event.spectator_enabled) throw Object.assign(new Error('Spectator reservations are not available.'), { code: 'TYPE_DISABLED' });
        const now = Date.now();
        if (Date.parse(event.starts_at) <= now || (event.registration_opens_at && Date.parse(event.registration_opens_at) > now) || (event.registration_closes_at && Date.parse(event.registration_closes_at) < now)) throw Object.assign(new Error('Registration is closed for this event.'), { code: 'REGISTRATION_CLOSED' });
        const existing = db.prepare('SELECT id FROM bookings WHERE event_id=? AND user_id=? AND booking_type=?').get(event.id, session.id, type);
        if (existing) throw Object.assign(new Error('You already have a booking for this event and type.'), { code: 'DUPLICATE' });
        const count = Number(db.prepare("SELECT COUNT(*) count FROM bookings WHERE event_id=? AND booking_type=? AND status IN ('pending','confirmed')").get(event.id, type).count);
        const capacity = type === 'participant' ? event.participant_capacity : event.spectator_capacity;
        if (count >= capacity) throw Object.assign(new Error('This booking type is full.'), { code: 'FULL' });
        const policy = type === 'participant' ? event.participant_policy : event.spectator_policy;
        const status = policy === 'review' ? 'pending' : 'confirmed';
        const id = newId();
        db.prepare('INSERT INTO bookings(id,event_id,user_id,booking_type,status) VALUES(?,?,?,?,?)').run(id, event.id, session.id, type, status);
        notify(session.id, `booking_${status}`, `Your ${type} booking for ${event.title} is ${status}.`, event.id, id);
        return db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      });
      return sendJson(res, 201, { booking: { id: booking.id, type: booking.booking_type, status: booking.status } });
    } catch (error) {
      const status = error.code === 'DUPLICATE' ? 409 : error.code === 'FULL' ? 409 : error.code === 'REGISTRATION_CLOSED' ? 409 : error.code === 'TYPE_DISABLED' ? 400 : 500;
      return fail(res, status, error.code || 'BOOKING_FAILED', status === 500 ? 'Booking could not be saved. Try again later.' : error.message);
    }
  }
  const cancelMatch = path.match(/^\/api\/my\/bookings\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const session = requiredSession(req, res); if (!session) return;
    if (!csrf(req, res, session)) return;
    try {
      const booking = transaction(() => {
        const current = db.prepare('SELECT b.*,e.title,e.id event_ref,e.starts_at FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=? AND b.user_id=?').get(cancelMatch[1], session.id);
        if (!current) throw Object.assign(new Error('Booking not found.'), { code: 'NOT_FOUND' });
        if (!['pending', 'confirmed'].includes(current.status)) throw Object.assign(new Error('This booking can no longer be cancelled.'), { code: 'INVALID_STATE' });
        if (Date.parse(current.starts_at) <= Date.now()) throw Object.assign(new Error('Bookings cannot be cancelled after the event has started.'), { code: 'INVALID_STATE' });
        db.prepare("UPDATE bookings SET status='cancelled',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(current.id);
        notify(session.id, 'booking_cancelled', `Your booking for ${current.title} was cancelled.`, current.event_ref, current.id);
        return current;
      });
      return sendJson(res, 200, { ok: true, id: booking.id });
    } catch (error) { return fail(res, error.code === 'NOT_FOUND' ? 404 : 409, error.code, error.message); }
  }
  if (path.startsWith('/api/admin/')) {
    const session = adminSession(req, res); if (!session) return;
    if (method === 'GET' && path === '/api/admin/overview') {
      const totals = {
        publishedEvents: Number(db.prepare("SELECT COUNT(*) c FROM events WHERE status='published' AND ends_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now')").get().c),
        upcomingEvents: Number(db.prepare("SELECT COUNT(*) c FROM events WHERE status='published' AND starts_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now')").get().c),
        openTryouts: Number(db.prepare("SELECT COUNT(*) c FROM events WHERE status='published' AND event_type LIKE '%tryout%' AND starts_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now')").get().c),
        pendingBookings: Number(db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='pending'").get().c),
        confirmedBookings: Number(db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='confirmed'").get().c)
      };
      const events = db.prepare('SELECT * FROM events ORDER BY starts_at DESC LIMIT 12').all().map(publicEvent);
      const pending = db.prepare(`SELECT b.id,b.booking_type,b.created_at,u.display_name,e.title event_title,e.id event_id FROM bookings b JOIN users u ON u.id=b.user_id JOIN events e ON e.id=b.event_id WHERE b.status='pending' ORDER BY b.created_at ASC LIMIT 10`).all();
      return sendJson(res, 200, { totals, events, pending });
    }
    if (method === 'GET' && path === '/api/admin/events') {
      const rows = db.prepare('SELECT * FROM events ORDER BY updated_at DESC LIMIT 200').all();
      return sendJson(res, 200, { events: rows.map(publicEvent) });
    }
    if (method === 'POST' && (path === '/api/admin/events' || /^\/api\/admin\/events\/[^/]+$/.test(path))) {
      if (!csrf(req, res, session)) return;
      const body = await jsonBody(req);
      const { errors, values } = validateEvent(body);
      if (Object.keys(errors).length) return sendJson(res, 400, { error: { code: 'VALIDATION_FAILED', message: 'Review the highlighted fields.', fields: errors } });
      const isEdit = path !== '/api/admin/events';
      const id = isEdit ? path.split('/').at(-1) : newId();
      let slug = slugify(body.slug || values.title) || id.slice(0, 8);
      if (db.prepare('SELECT id FROM events WHERE slug=? AND id<>?').get(slug, id)) slug = `${slug}-${id.slice(0, 6)}`;
      if (isEdit) {
        const existing = db.prepare('SELECT * FROM events WHERE id=?').get(id);
        if (!existing) return fail(res, 404, 'NOT_FOUND', 'Event not found.');
        const counts = bookingCounts(id);
        if (values.participantCapacity < (counts.participant || 0) || values.spectatorCapacity < (counts.spectator || 0)) return fail(res, 409, 'CAPACITY_BELOW_BOOKINGS', 'Capacity cannot be lower than pending and confirmed bookings.');
        transaction(() => {
          db.prepare(`UPDATE events SET title=?,slug=?,description=?,sport=?,event_type=?,organizer=?,venue=?,address=?,latitude=?,longitude=?,location_unavailable=?,starts_at=?,ends_at=?,registration_opens_at=?,registration_closes_at=?,participant_capacity=?,spectator_capacity=?,participant_policy=?,spectator_policy=?,participant_enabled=?,spectator_enabled=?,eligibility=?,instructions=?,status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
            .run(values.title, slug, values.description, values.sport, values.eventType, values.organizer, values.venue, values.address, values.latitude, values.longitude, +values.locationUnavailable, values.startsAt, values.endsAt, values.registrationOpensAt, values.registrationClosesAt, values.participantCapacity, values.spectatorCapacity, values.participantPolicy, values.spectatorPolicy, +values.participantEnabled, +values.spectatorEnabled, values.eligibility, values.instructions, values.status, id);
          const recipients = db.prepare('SELECT DISTINCT user_id FROM bookings WHERE event_id=? AND status IN (\'pending\',\'confirmed\')').all(id);
          const scheduleChanged = existing.starts_at !== values.startsAt || existing.ends_at !== values.endsAt;
          const statusChanged = existing.status !== values.status;
          if (scheduleChanged || statusChanged) {
            const cancelled = values.status === 'cancelled';
            const message = cancelled ? `The event ${values.title} was cancelled by its organizer.` : scheduleChanged ? `The schedule for ${values.title} has changed. Check the updated event details.` : `The status for ${values.title} changed to ${values.status}.`;
            if (cancelled) db.prepare("UPDATE bookings SET status='cancelled',decision_note='Event cancelled by organizer',decided_by=?,decided_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE event_id=? AND status IN ('pending','confirmed')").run(session.id, id);
            for (const recipient of recipients) notify(recipient.user_id, cancelled ? 'event_cancelled' : 'event_updated', message, id);
          }
          audit(session.id, 'event_updated', 'event', id, { status: values.status });
        });
      } else {
        transaction(() => {
          db.prepare(`INSERT INTO events(id,title,slug,description,sport,event_type,organizer,venue,address,latitude,longitude,location_unavailable,starts_at,ends_at,registration_opens_at,registration_closes_at,participant_capacity,spectator_capacity,participant_policy,spectator_policy,participant_enabled,spectator_enabled,eligibility,instructions,status,created_by)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, values.title, slug, values.description, values.sport, values.eventType, values.organizer, values.venue, values.address, values.latitude, values.longitude, +values.locationUnavailable, values.startsAt, values.endsAt, values.registrationOpensAt, values.registrationClosesAt, values.participantCapacity, values.spectatorCapacity, values.participantPolicy, values.spectatorPolicy, +values.participantEnabled, +values.spectatorEnabled, values.eligibility, values.instructions, values.status, session.id);
          audit(session.id, 'event_created', 'event', id, { status: values.status });
        });
      }
      return sendJson(res, isEdit ? 200 : 201, { event: publicEvent(db.prepare('SELECT * FROM events WHERE id=?').get(id)) });
    }
    const decisionMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)\/decision$/);
    if (method === 'POST' && decisionMatch) {
      if (!csrf(req, res, session)) return;
      const body = await jsonBody(req);
      if (!['confirmed', 'rejected'].includes(body.status)) return fail(res, 400, 'INVALID_DECISION', 'Choose approve or reject.');
      try {
        const booking = transaction(() => {
          const current = db.prepare('SELECT b.*,e.title,e.participant_capacity,e.spectator_capacity,e.id event_ref,e.status event_status,e.starts_at,e.registration_closes_at FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=?').get(decisionMatch[1]);
          if (!current) throw Object.assign(new Error('Booking not found.'), { code: 'NOT_FOUND' });
          if (current.status !== 'pending') throw Object.assign(new Error('Only pending bookings can be decided.'), { code: 'INVALID_STATE' });
          if (body.status === 'confirmed') {
            if (current.event_status !== 'published' || Date.parse(current.starts_at) <= Date.now() || (current.registration_closes_at && Date.parse(current.registration_closes_at) < Date.now())) throw Object.assign(new Error('This event is no longer accepting confirmed bookings.'), { code: 'REGISTRATION_CLOSED' });
            const cap = current.booking_type === 'participant' ? current.participant_capacity : current.spectator_capacity;
            const count = Number(db.prepare("SELECT COUNT(*) c FROM bookings WHERE event_id=? AND booking_type=? AND status IN ('pending','confirmed')").get(current.event_id, current.booking_type).c);
            if (count > cap) throw Object.assign(new Error('Capacity is no longer available.'), { code: 'CAPACITY_CONFLICT' });
          }
          const note = String(body.note || '').trim().slice(0, 500);
          db.prepare("UPDATE bookings SET status=?,decision_note=?,decided_by=?,decided_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(body.status, note, session.id, current.id);
          notify(current.user_id, `booking_${body.status}`, `Your ${current.booking_type} booking for ${current.title} was ${body.status}.${note ? ` ${note}` : ''}`, current.event_ref, current.id);
          audit(session.id, `booking_${body.status}`, 'booking', current.id, { note });
          return { id: current.id, status: body.status };
        });
        return sendJson(res, 200, { booking });
      } catch (error) { return fail(res, error.code === 'NOT_FOUND' ? 404 : 409, error.code, error.message); }
    }
    const registrationsMatch = path.match(/^\/api\/admin\/events\/([^/]+)\/bookings$/);
    if (method === 'GET' && registrationsMatch) {
      const rows = db.prepare(`SELECT b.id,b.booking_type,b.status,b.decision_note,b.created_at,u.display_name,e.id event_id FROM bookings b JOIN users u ON u.id=b.user_id JOIN events e ON e.id=b.event_id WHERE e.id=? ORDER BY b.created_at DESC LIMIT 500`).all(registrationsMatch[1]);
      return sendJson(res, 200, { bookings: rows });
    }
    return fail(res, 404, 'NOT_FOUND', 'Admin endpoint not found.');
  }
  if (method === 'POST' && path === '/api/my/notifications/read') {
    const session = requiredSession(req, res); if (!session) return;
    if (!csrf(req, res, session)) return;
    const body = await jsonBody(req);
    if (body.id) db.prepare("UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?").run(body.id, session.id);
    else db.prepare("UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND read_at IS NULL").run(session.id);
    return sendJson(res, 200, { ok: true });
  }
  if (path.startsWith('/api/')) return fail(res, 404, 'NOT_FOUND', 'API endpoint not found.');

  const requestedPath = path === '/' ? '/index.html' : path;
  const file = resolve(root, `.${requestedPath}`);
  if (file !== root && !file.startsWith(root + sep)) return fail(res, 404, 'NOT_FOUND', 'Page not found.');
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': typeConfig[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://www.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    res.end(content);
  } catch { fail(res, 404, 'NOT_FOUND', 'Page not found.'); }
}

cleanupExpiredSessions();
const server = createServer(async (req, res) => {
  try { await route(req, res); }
  catch (error) {
    if (res.headersSent) return res.destroy();
    const status = error.status || 500;
    sendJson(res, status, { error: { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED', message: status === 500 ? 'The request could not be completed.' : error.message } });
    if (status === 500) console.error('Request failed:', error.message);
  }
});
server.listen(port, () => console.log(`Sportshub listening on http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
