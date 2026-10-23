import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createNetServer } from 'node:net';

let serverProcess, db, auth, baseUrl, tempPath;
async function freePort() {
  const probe = createNetServer();
  await new Promise(resolveListen => probe.listen(0, '127.0.0.1', resolveListen));
  const port = probe.address().port;
  await new Promise(resolveClose => probe.close(resolveClose));
  return port;
}
async function request(path, { method = 'GET', body, cookie, csrf } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  if (method !== 'GET') headers.origin = baseUrl;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  const setCookie = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || '';
  return { response, data, cookie: setCookie.split(';')[0] };
}
async function waitReady() {
  for (let attempt = 0; attempt < 70; attempt++) {
    if (serverProcess.exitCode != null) throw new Error(`Server exited early with code ${serverProcess.exitCode}`);
    try { const response = await fetch(`${baseUrl}/api/health`); if (response.ok) return; } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error('Server did not become ready.');
}

before(async () => {
  tempPath = await mkdtemp(join(tmpdir(), 'sportshub-test-'));
  const databasePath = join(tempPath, 'test.sqlite');
  const port = await freePort(); baseUrl = `http://127.0.0.1:${port}`;
  process.env.DATABASE_PATH = databasePath; process.env.NODE_ENV = 'test';
  const dbModule = await import('../src/db.js'); db = dbModule.db;
  auth = await import('../src/auth.js');
  const passwordHash = await auth.hashPassword('admin-test-password-123');
  db.prepare("INSERT INTO users(id,email,display_name,password_hash,role) VALUES('admin-test','admin@example.test','Test Admin',?,'admin')").run(passwordHash);
  serverProcess = spawn(process.execPath, [resolve('src/server.js')], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await waitReady();
});

after(async () => {
  if (serverProcess && serverProcess.exitCode == null) { serverProcess.kill('SIGTERM'); await new Promise(resolveClose => serverProcess.once('exit', resolveClose)); }
  db?.close();
  if (tempPath) await rm(tempPath, { recursive: true, force: true });
});

test('registration, authorization, and bookings persist with capacity enforcement', async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Find your next/);

  const studentRegistration = await request('/api/auth/register', { method: 'POST', body: { displayName: 'Student One', email: 'student@example.test', password: 'student-test-password-123' } });
  assert.equal(studentRegistration.response.status, 201);
  const studentCookie = studentRegistration.cookie;
  const studentCsrf = studentRegistration.data.csrfToken;
  assert.ok(studentCookie.includes('sportshub_session='));
  assert.equal(studentRegistration.data.user.role, 'student');
  assert.equal((await request('/api/admin/overview', { cookie: studentCookie })).response.status, 403);

  const adminLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'admin-test-password-123' } });
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.data.user.role, 'admin');

  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
  const event = await request('/api/admin/events', { method: 'POST', cookie: adminLogin.cookie, csrf: adminLogin.data.csrfToken, body: {
    title: 'Fixture Basketball Tryout', sport: 'Basketball', eventType: 'Tryout', organizer: 'Test Organizer', venue: 'Test Venue', address: 'Test Address',
    latitude: 0, longitude: 0, startsAt, endsAt, registrationOpensAt: '', registrationClosesAt: '', participantCapacity: 2, spectatorCapacity: 1,
    participantPolicy: 'review', spectatorPolicy: 'automatic', participantEnabled: true, spectatorEnabled: true, status: 'published', description: 'Test fixture only.', eligibility: '', instructions: ''
  } });
  assert.equal(event.response.status, 201, JSON.stringify(event.data));
  const slug = event.data.event.slug;
  const booking = await request(`/api/events/${slug}/bookings`, { method: 'POST', cookie: studentCookie, csrf: studentCsrf, body: { type: 'participant' } });
  assert.equal(booking.response.status, 201);
  assert.equal(booking.data.booking.status, 'pending');

  const secondRegistration = await request('/api/auth/register', { method: 'POST', body: { displayName: 'Student Two', email: 'student2@example.test', password: 'student-two-test-password-123' } });
  const thirdRegistration = await request('/api/auth/register', { method: 'POST', body: { displayName: 'Student Three', email: 'student3@example.test', password: 'student-three-test-password-123' } });
  const lastSpotAttempts = await Promise.all([
    request(`/api/events/${slug}/bookings`, { method: 'POST', cookie: secondRegistration.cookie, csrf: secondRegistration.data.csrfToken, body: { type: 'participant' } }),
    request(`/api/events/${slug}/bookings`, { method: 'POST', cookie: thirdRegistration.cookie, csrf: thirdRegistration.data.csrfToken, body: { type: 'participant' } })
  ]);
  assert.deepEqual(lastSpotAttempts.map(result => result.response.status).sort(), [201, 409]);
  const full = lastSpotAttempts.find(result => result.response.status === 409);
  assert.equal(full.data.error.code, 'FULL');
  const spectator = await request(`/api/events/${slug}/bookings`, { method: 'POST', cookie: secondRegistration.cookie, csrf: secondRegistration.data.csrfToken, body: { type: 'spectator' } });
  assert.equal(spectator.response.status, 201);
  assert.equal(spectator.data.booking.status, 'confirmed');
  const approved = await request(`/api/admin/bookings/${booking.data.booking.id}/decision`, { method: 'POST', cookie: adminLogin.cookie, csrf: adminLogin.data.csrfToken, body: { status: 'confirmed' } });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.data.booking.status, 'confirmed');
  const selfCancel = await request(`/api/my/bookings/${booking.data.booking.id}/cancel`, { method: 'POST', cookie: studentCookie, csrf: studentCsrf, body: {} });
  assert.equal(selfCancel.response.status, 200);
  const lastSpotLoser = lastSpotAttempts[0].response.status === 409 ? secondRegistration : thirdRegistration;
  const retryAfterCancellation = await request(`/api/events/${slug}/bookings`, { method: 'POST', cookie: lastSpotLoser.cookie, csrf: lastSpotLoser.data.csrfToken, body: { type: 'participant' } });
  assert.equal(retryAfterCancellation.response.status, 201);

  const privateBookings = await request('/api/my/bookings', { cookie: secondRegistration.cookie });
  assert.equal(privateBookings.data.bookings.length, 2);
  assert.deepEqual(privateBookings.data.bookings.map(item => item.type).sort(), ['participant', 'spectator']);
  const deniedCancel = await request(`/api/my/bookings/${booking.data.booking.id}/cancel`, { method: 'POST', cookie: secondRegistration.cookie, csrf: secondRegistration.data.csrfToken, body: {} });
  assert.equal(deniedCancel.response.status, 404);
  const adminRows = await request(`/api/admin/events/${event.data.event.id}/bookings`, { cookie: adminLogin.cookie });
  assert.equal(adminRows.response.status, 200);
  assert.equal(adminRows.data.bookings.length, 4);

  const cancelled = await request(`/api/admin/events/${event.data.event.id}`, { method: 'POST', cookie: adminLogin.cookie, csrf: adminLogin.data.csrfToken, body: {
    ...event.data.event, eventType: event.data.event.type, event: undefined, status: 'cancelled'
  } });
  assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.data));
  const privateEvent = await request(`/api/events/${slug}`, { cookie: studentCookie });
  assert.equal(privateEvent.response.status, 200);
  const publicEvents = await request('/api/events');
  assert.equal(publicEvents.data.events.length, 0);
  const notices = await request('/api/my/notifications', { cookie: secondRegistration.cookie });
  assert.ok(notices.data.notifications.some(item => item.kind === 'event_cancelled'));
});

test('invalid credentials and missing CSRF tokens fail safely', async () => {
  const invalid = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'wrong-password-123' } });
  assert.equal(invalid.response.status, 401);
  const session = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'admin-test-password-123' } });
  const rejected = await request('/api/admin/events', { method: 'POST', cookie: session.cookie, body: {} });
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.data.error.code, 'CSRF_REJECTED');
  const malformed = await request('/api/admin/events', { method: 'POST', cookie: session.cookie, csrf: 'x', body: {} });
  assert.equal(malformed.response.status, 403);
  assert.equal(malformed.data.error.code, 'CSRF_REJECTED');
});
