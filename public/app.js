const state = { user: null, csrf: null, events: [], allEvents: [], bookings: [], notifications: [], adminOverview: null, authMode: 'login', activeSlug: null, confirmAction: null, mapEvents: [] };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (options.method && options.method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  let response;
  try { response = await fetch(path, { credentials: 'same-origin', ...options, headers }); }
  catch { throw new Error('Connection problem. Check your network and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'The request could not be completed.');
    error.status = response.status; error.code = data.error?.code; error.fields = data.error?.fields;
    throw error;
  }
  return data;
}
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function dateTime(value, options = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Schedule to be announced';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', ...(options.time === false ? {} : { timeStyle: 'short' }) }).format(new Date(value));
}
function notify(message, isError = false) {
  const el = document.createElement('div'); el.className = `toast${isError ? ' error' : ''}`; el.textContent = message;
  $('#toast-region').append(el); setTimeout(() => el.remove(), 3800);
}
function setView(name) {
  const eventRoute = name.startsWith('event/');
  const view = eventRoute ? 'detail' : name;
  const allowed = ['home', 'events', 'map', 'dashboard', 'admin', 'detail'];
  const actual = allowed.includes(view) ? view : 'home';
  if (['dashboard', 'admin'].includes(actual) && !state.user) { history.replaceState(null, '', '#home'); showAuth('login'); return; }
  if (actual === 'admin' && state.user.role !== 'admin') { history.replaceState(null, '', '#home'); notify('Administrator access is required.', true); return; }
  $$('.view').forEach(section => section.classList.toggle('active', section.dataset.view === actual));
  $$('.main-nav a').forEach(link => link.classList.toggle('active', link.dataset.nav === actual));
  $('.main-nav').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false');
  if (eventRoute) { state.activeSlug = name.slice(6); loadDetail(state.activeSlug); }
  if (actual === 'dashboard') loadDashboard();
  if (actual === 'admin') loadAdmin();
  if (actual === 'map') loadMap();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function syncHash() { setView(decodeURIComponent(location.hash.slice(1) || 'home')); }
function openAuth(mode = 'login') {
  state.authMode = mode; setAuthMode(mode);
  const dialog = $('#auth-dialog'); if (!dialog.open) dialog.showModal();
}
function setAuthMode(mode) {
  state.authMode = mode;
  $$('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.authMode === mode));
  $$('.register-only').forEach(item => item.classList.toggle('hidden', mode !== 'register'));
  $('#auth-title').textContent = mode === 'login' ? 'Welcome back.' : 'Join the lineup.';
  $('#auth-subtitle').textContent = mode === 'login' ? 'Sign in to manage your bookings.' : 'Create your Sportshub account to get started.';
  $('#auth-submit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  $('#auth-form [name="password"]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#auth-feedback').textContent = mode === 'register' ? 'New accounts are created with student access.' : '';
}
function showAuth(mode = 'login') { openAuth(mode); }
function updateAccount() {
  $('#auth-open').classList.toggle('hidden', Boolean(state.user));
  $('#account-badge').classList.toggle('hidden', !state.user);
  $('#notifications-open').classList.toggle('hidden', !state.user);
  $('#admin-nav').classList.toggle('hidden', state.user?.role !== 'admin');
  if (state.user) $('#account-badge').textContent = state.user.displayName;
}
function eventArt(event, index = 0) {
  const initials = esc(event.sport.split(/\s+/).map(word => word[0]).join('').slice(0, 3));
  return `<div class="event-art art-${index % 3}"><span class="art-index">SH / ${String(index + 1).padStart(2, '0')}</span><span class="art-sport">${initials}</span><span class="art-type">${esc(event.type)}</span></div>`;
}
function eventCard(event, index = 0) {
  const cap = event.participantCapacity;
  const remaining = Math.max(0, cap - event.participantCount);
  const status = event.participantEnabled ? (remaining ? `${remaining} participant${remaining === 1 ? '' : 's'} open` : 'Participants full') : event.spectatorEnabled ? 'Spectators welcome' : 'Details available';
  return `<article class="event-card">${eventArt(event, index)}<div class="event-card-body"><div class="event-meta"><span>${esc(event.sport)}</span><span>${esc(dateTime(event.startsAt, { time: false }))}</span></div><h3>${esc(event.title)}</h3><p class="event-place">${esc(event.venue)}${event.address ? ` · ${esc(event.address)}` : ''}</p><div class="event-card-bottom"><span class="availability ${remaining ? 'open' : event.participantEnabled ? 'full' : ''}">${esc(status)}</span><a class="card-link" href="#event/${encodeURIComponent(event.slug)}">View event <span aria-hidden="true">↗</span></a></div></div></article>`;
}
function emptyState(title, message, action = '') {
  return `<div class="empty-state"><div class="empty-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></div><h3>${esc(title)}</h3><p>${esc(message)}</p>${action ? `<div class="empty-action">${action}</div>` : ''}</div>`;
}
function setEventFilters(events) {
  const sports = [...new Set(events.map(event => event.sport))].sort();
  const types = [...new Set(events.map(event => event.type))].sort();
  const sport = $('#sport-filter'), type = $('#type-filter');
  const oldSport = sport.value, oldType = type.value;
  sport.innerHTML = '<option value="">All sports</option>' + sports.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
  type.innerHTML = '<option value="">All event types</option>' + types.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
  sport.value = sports.includes(oldSport) ? oldSport : ''; type.value = types.includes(oldType) ? oldType : '';
}
function applyFilters() {
  const q = $('#search-input').value.trim().toLowerCase();
  const sport = $('#sport-filter').value, type = $('#type-filter').value;
  state.events = state.allEvents.filter(event => (!q || `${event.title} ${event.sport} ${event.venue} ${event.address}`.toLowerCase().includes(q)) && (!sport || event.sport === sport) && (!type || event.type === type));
  $('#events-list').innerHTML = state.events.length ? state.events.map(eventCard).join('') : emptyState('No matching events', 'Try another keyword or clear the filters to see all published events.');
  $('#event-result-count').textContent = `${state.events.length} ${state.events.length === 1 ? 'event' : 'events'} found`;
}
async function loadEvents() {
  try {
    const data = await api('/api/events'); state.allEvents = data.events;
    setEventFilters(state.allEvents); applyFilters();
    $('#home-events').innerHTML = state.allEvents.length ? state.allEvents.slice(0, 3).map(eventCard).join('') : emptyState('The next game is yours to add', 'No published events are listed yet. Check back soon, or sign in and stay ready.');
  } catch (error) {
    $('#events-list').innerHTML = emptyState('Events are unavailable right now', error.message);
    $('#home-events').innerHTML = emptyState('Could not load events', error.message);
    $('#event-result-count').textContent = 'Unable to load events';
  }
}
async function loadDetail(slug) {
  const box = $('#event-detail'); box.innerHTML = '<div class="page-view"><p>Loading event details…</p></div>';
  try {
    const { event } = await api(`/api/events/${encodeURIComponent(slug)}`);
    const participantLeft = Math.max(0, event.participantCapacity - event.participantCount);
    const spectatorLeft = Math.max(0, event.spectatorCapacity - event.spectatorCount);
    const canBook = event.status === 'published' && Date.parse(event.startsAt) > Date.now() && (!event.registrationOpensAt || Date.parse(event.registrationOpensAt) <= Date.now()) && (!event.registrationClosesAt || Date.parse(event.registrationClosesAt) >= Date.now());
    const available = (event.participantEnabled && participantLeft > 0) || (event.spectatorEnabled && spectatorLeft > 0);
    box.innerHTML = `<div class="detail-hero"><div class="eyebrow"><a href="#events">EVENTS</a><span>/</span>${esc(event.sport)} · ${esc(event.type)}</div><h1>${esc(event.title)}</h1><div class="event-meta"><span>${esc(event.organizer)}</span><span>${esc(dateTime(event.startsAt))}</span></div></div><div class="detail-content"><section class="detail-description"><h2>Event details</h2><p>${esc(event.description || 'The organizer has not added a description yet.')}</p><div class="detail-facts"><div class="detail-fact"><span>Date and time</span><strong>${esc(dateTime(event.startsAt))} – ${esc(dateTime(event.endsAt))}</strong></div><div class="detail-fact"><span>Venue</span><strong>${esc(event.venue)}</strong></div><div class="detail-fact"><span>Organizer</span><strong>${esc(event.organizer)}</strong></div><div class="detail-fact"><span>Address</span><strong>${esc(event.address || 'See organizer details')}</strong></div></div>${event.locationUnavailable ? '<p>Map location is unavailable or has not been verified.</p>' : ''}${event.eligibility ? `<h2>Eligibility</h2><p>${esc(event.eligibility)}</p>` : ''}${event.instructions ? `<h2>Instructions</h2><p>${esc(event.instructions)}</p>` : ''}</section><aside class="detail-side"><div class="eyebrow">BOOKING OPTIONS</div><h2>Choose your spot</h2>${event.status === 'cancelled' ? '<p class="availability full">This event was cancelled.</p>' : ''}${event.participantEnabled && event.status !== 'cancelled' ? `<p>Participant registration · ${participantLeft} of ${event.participantCapacity} places available · ${event.participantPolicy === 'review' ? 'review required' : 'instant confirmation'}</p><button class="button button-orange" data-book="participant" ${!canBook || !participantLeft ? 'disabled' : ''}>Register as participant</button>` : ''}${event.spectatorEnabled && event.status !== 'cancelled' ? `<p class="booking-option-note">Spectator reservation · ${spectatorLeft} of ${event.spectatorCapacity} places available · ${event.spectatorPolicy === 'review' ? 'review required' : 'instant confirmation'}</p><button class="button button-dark" data-book="spectator" ${!canBook || !spectatorLeft ? 'disabled' : ''}>Reserve as spectator</button>` : ''}${event.status !== 'cancelled' && (!available || !canBook) ? `<p class="availability full">${!canBook ? 'Registration is closed.' : 'No booking types are currently available.'}</p>` : ''}${event.registrationClosesAt ? `<p>Registration closes ${esc(dateTime(event.registrationClosesAt))}</p>` : ''}<p>Booking updates appear in your Sportshub account.</p></aside></div>`;
    $$('[data-book]', box).forEach(button => button.addEventListener('click', () => bookEvent(event.slug, button.dataset.book, button)));
  } catch (error) { box.innerHTML = `<div class="page-view">${emptyState('Event unavailable', error.message, '<a class="button button-dark" href="#events">Back to events</a>')}</div>`; }
}
async function bookEvent(slug, type, button) {
  if (!state.user) return showAuth('login');
  if (button) button.disabled = true;
  try {
    const { booking } = await api(`/api/events/${encodeURIComponent(slug)}/bookings`, { method: 'POST', body: JSON.stringify({ type }) });
    notify(booking.status === 'pending' ? 'Request submitted for review.' : 'Your place is confirmed.');
    await loadDetail(slug); await loadDashboardData();
  } catch (error) { notify(error.message, true); }
  finally { if (button) button.disabled = false; }
}
async function refreshSession() {
  const data = await api('/api/session'); state.user = data.user; state.csrf = data.csrfToken;
  updateAccount();
}
async function loadDashboardData() {
  if (!state.user) return;
  try {
    const [bookingsData, notificationsData] = await Promise.all([api('/api/my/bookings'), api('/api/my/notifications')]);
    state.bookings = bookingsData.bookings; state.notifications = notificationsData.notifications;
    renderDashboard();
  } catch (error) { notify(error.message, true); }
}
async function loadDashboard() {
  if (!state.user) return;
  $('#welcome-name').textContent = state.user.displayName.split(' ')[0];
  const form = $('#profile-form'); form.elements.displayName.value = state.user.displayName; form.elements.email.value = state.user.email;
  form.elements.sportsInterests.value = state.user.sportsInterests.join(', ');
  await loadDashboardData();
}
function renderDashboard() {
  $('#booking-count').textContent = state.bookings.length;
  $('#my-bookings').innerHTML = state.bookings.length ? state.bookings.map(booking => `<article class="booking-row"><div><h3><a href="#event/${encodeURIComponent(booking.eventSlug)}">${esc(booking.title)}</a></h3><p>${esc(booking.sport)} · ${esc(booking.type)} · ${esc(dateTime(booking.startsAt))}</p></div><div class="booking-actions"><span class="status-pill ${esc(booking.status)}">${esc(booking.status)}</span>${['pending', 'confirmed'].includes(booking.status) ? `<button class="small-action" data-cancel-booking="${esc(booking.id)}">Cancel</button>` : ''}</div></article>`).join('') : emptyState('No bookings yet', 'Explore the lineup and register for an event that fits your game.');
  $$('[data-cancel-booking]').forEach(button => button.addEventListener('click', () => confirmAction('Cancel this booking?', 'Your booking will be cancelled and the place may become available to someone else.', async () => {
    await api(`/api/my/bookings/${button.dataset.cancelBooking}/cancel`, { method: 'POST', body: '{}' }); notify('Booking cancelled.'); await loadDashboardData();
  })));
  $('#my-notifications').innerHTML = state.notifications.length ? state.notifications.slice(0, 8).map(item => `<article class="notification-row ${item.read_at ? '' : 'unread'}"><div><strong>${esc(item.kind.replaceAll('_', ' '))}</strong><p>${esc(item.message)}</p></div><time>${esc(dateTime(item.created_at, { time: false }))}</time></article>`).join('') : emptyState('No updates yet', 'Booking and event changes will appear here.');
  $('#notification-dot').classList.toggle('hidden', !state.notifications.some(item => !item.read_at));
}
function confirmAction(title, message, action) {
  state.confirmAction = action; $('#confirm-title').textContent = title; $('#confirm-copy').textContent = message; $('#confirm-dialog').showModal();
}
async function loadMap() {
  try {
    const { events } = await api('/api/events');
    state.mapEvents = events.filter(event => Number.isFinite(event.latitude) && Number.isFinite(event.longitude));
    $('#map-count').textContent = state.mapEvents.length;
    if (!state.mapEvents.length) {
      $('#map-panel').innerHTML = `<div class="map-empty"><div class="map-empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 8 4l8 2.5L21 4v13.5L16 20l-8-2.5L3 20V6.5Z"/><path d="M8 4v13.5M16 6.5V20"/></svg></div><h2>No verified event locations yet</h2><p>Published events appear here only after an administrator adds verified coordinates. The app does not guess locations or request your device location.</p></div>`;
      $('#map-events').innerHTML = emptyState('No map locations', 'You can still explore published events by venue and address.'); $('#map-attribution').classList.add('hidden'); return;
    }
    $('#map-events').innerHTML = state.mapEvents.map(event => `<article class="map-event-item" data-map-event="${esc(event.slug)}"><strong>${esc(event.title)}</strong><span>${esc(event.venue)} · ${esc(dateTime(event.startsAt, { time: false }))}</span><button type="button" data-open-map="${esc(event.slug)}">Show</button></article>`).join('');
    $$('[data-open-map]').forEach(button => button.addEventListener('click', () => showMapMarker(button.dataset.openMap)));
    $$('.map-event-item').forEach(item => item.addEventListener('click', event => { if (event.target.closest('button')) return; showMapMarker(item.dataset.mapEvent); }));
    $('#map-attribution').classList.remove('hidden'); showMapMarker(state.mapEvents[0].slug);
  } catch (error) { $('#map-panel').innerHTML = `<div class="map-empty"><h2>Map locations unavailable</h2><p>${esc(error.message)}</p></div>`; }
}
function showMapMarker(slug) {
  const event = state.mapEvents.find(item => item.slug === slug); if (!event) return;
  const pad = .015;
  const bbox = `${event.longitude - pad}%2C${event.latitude - pad}%2C${event.longitude + pad}%2C${event.latitude + pad}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${event.latitude}%2C${event.longitude}`;
  $('#map-panel').innerHTML = `<iframe title="Map showing ${esc(event.title)} at ${esc(event.venue)}" loading="lazy" referrerpolicy="no-referrer" src="${src}"></iframe>`;
  $$('.map-event-item').forEach(item => item.classList.toggle('selected', item.dataset.mapEvent === slug));
}
async function loadAdmin() {
  try {
    const data = await api('/api/admin/overview'); state.adminOverview = data;
    $('#admin-metrics').innerHTML = Object.entries({ 'Published events': data.totals.publishedEvents, 'Upcoming events': data.totals.upcomingEvents, 'Open tryouts': data.totals.openTryouts, 'Pending requests': data.totals.pendingBookings, 'Confirmed bookings': data.totals.confirmedBookings }).map(([label, value]) => `<article class="metric-card"><span>${esc(label)}</span><strong>${value}</strong></article>`).join('');
    $('#admin-events').innerHTML = data.events.length ? data.events.map(event => `<article class="admin-event-row"><div><strong>${esc(event.title)}</strong><p>${esc(event.sport)} · ${esc(event.type)} · ${esc(dateTime(event.startsAt))} · ${esc(event.status)}</p></div><div class="admin-event-actions"><span class="status-pill ${esc(event.status)}">${esc(event.status)}</span><button class="small-action" data-edit-event="${esc(event.id)}">Edit</button></div></article>`).join('') : emptyState('No events created', 'Create a draft or publish an event when its details are ready.');
    $('#pending-bookings').innerHTML = data.pending.length ? data.pending.map(item => `<article class="pending-row"><div><strong>${esc(item.display_name)}</strong><p>${esc(item.event_title)} · ${esc(item.booking_type)}</p></div><div class="decision-actions"><button class="button button-dark" data-decision="${esc(item.id)}" data-status="confirmed">Approve</button><button class="button button-quiet" data-decision="${esc(item.id)}" data-status="rejected">Reject</button></div></article>`).join('') : emptyState('Nothing pending', 'New requests that need a decision will show up here.');
    $$('[data-decision]').forEach(button => button.addEventListener('click', () => decideBooking(button.dataset.decision, button.dataset.status)));
    $$('[data-edit-event]').forEach(button => button.addEventListener('click', () => editEvent(button.dataset.editEvent)));
  } catch (error) { notify(error.message, true); }
}
async function decideBooking(id, status) {
  try { await api(`/api/admin/bookings/${id}/decision`, { method: 'POST', body: JSON.stringify({ status }) }); notify(`Booking ${status}.`); await loadAdmin(); }
  catch (error) { notify(error.message, true); }
}
function localDateInput(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
async function editEvent(id) {
  try {
    const event = state.adminOverview.events.find(item => item.id === id) || (await api(`/api/admin/events`)).events.find(item => item.id === id);
    if (!event) return notify('Event not found.', true);
    const form = $('#event-form'); form.reset(); form.elements.id.value = event.id;
    const mapping = { title: 'title', sport: 'sport', eventType: 'type', organizer: 'organizer', venue: 'venue', address: 'address', startsAt: 'startsAt', endsAt: 'endsAt', registrationOpensAt: 'registrationOpensAt', registrationClosesAt: 'registrationClosesAt', participantCapacity: 'participantCapacity', spectatorCapacity: 'spectatorCapacity', participantPolicy: 'participantPolicy', spectatorPolicy: 'spectatorPolicy', latitude: 'latitude', longitude: 'longitude', locationUnavailable: 'locationUnavailable', participantEnabled: 'participantEnabled', spectatorEnabled: 'spectatorEnabled', status: 'status', description: 'description', eligibility: 'eligibility', instructions: 'instructions' };
    for (const [field, key] of Object.entries(mapping)) {
      if (['startsAt', 'endsAt', 'registrationOpensAt', 'registrationClosesAt'].includes(field)) form.elements[field].value = localDateInput(event[key]);
      else if (['participantEnabled', 'spectatorEnabled', 'locationUnavailable'].includes(field)) form.elements[field].checked = event[key];
      else form.elements[field].value = event[key] ?? '';
    }
    $('#event-editor-title').textContent = 'Edit event'; $('#event-editor').classList.remove('hidden'); $('#event-editor').scrollIntoView({ behavior: 'smooth' });
  } catch (error) { notify(error.message, true); }
}
function buildEventPayload(form) {
  const value = name => form.elements[name].value;
  const iso = name => value(name) ? new Date(`${value(name)}:00+08:00`).toISOString() : '';
  return { id: value('id'), title: value('title'), sport: value('sport'), eventType: value('eventType'), organizer: value('organizer'), venue: value('venue'), address: value('address'), startsAt: iso('startsAt'), endsAt: iso('endsAt'), registrationOpensAt: iso('registrationOpensAt'), registrationClosesAt: iso('registrationClosesAt'), participantCapacity: Number(value('participantCapacity')), spectatorCapacity: Number(value('spectatorCapacity')), participantPolicy: value('participantPolicy'), spectatorPolicy: value('spectatorPolicy'), latitude: value('latitude'), longitude: value('longitude'), locationUnavailable: form.elements.locationUnavailable.checked, participantEnabled: form.elements.participantEnabled.checked, spectatorEnabled: form.elements.spectatorEnabled.checked, status: value('status'), description: value('description'), eligibility: value('eligibility'), instructions: value('instructions') };
}
async function submitEvent(form) {
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  $('#event-form-feedback').textContent = 'Saving…'; $('#event-form-feedback').classList.remove('success');
  const payload = buildEventPayload(form); const editing = Boolean(payload.id);
  try {
    const result = await api(editing ? `/api/admin/events/${payload.id}` : '/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
    $('#event-form-feedback').textContent = 'Saved.'; $('#event-form-feedback').classList.add('success'); notify('Event saved.');
    if (!editing) form.reset(); await loadAdmin(); await loadEvents();
  } catch (error) {
    const fields = error.fields ? Object.entries(error.fields).map(([field, message]) => `${field}: ${message}`).join(' · ') : error.message;
    $('#event-form-feedback').textContent = fields; $('#event-form-feedback').classList.remove('success');
  } finally { if (submitButton) submitButton.disabled = false; }
}
function bind() {
  const longitudeField = $('#event-form [name="longitude"]');
  longitudeField?.closest('label')?.insertAdjacentHTML('afterend', '<label class="check-label"><input name="locationUnavailable" type="checkbox"> Location unavailable or not verified</label>');
  window.addEventListener('hashchange', syncHash);
  $('#auth-open').addEventListener('click', () => openAuth('login'));
  $('#hero-signup').addEventListener('click', () => openAuth('register'));
  $('#cta-signup').addEventListener('click', () => openAuth('register'));
  $('#auth-close').addEventListener('click', () => $('#auth-dialog').close());
  $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode)));
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = $('#auth-submit'); button.disabled = true; $('#auth-feedback').textContent = 'Working…';
    const path = state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = { email: form.elements.email.value, password: form.elements.password.value };
    if (state.authMode === 'register') body.displayName = form.elements.displayName.value;
    try {
      const data = await api(path, { method: 'POST', body: JSON.stringify(body) }); state.user = data.user; state.csrf = data.csrfToken;
      $('#auth-dialog').close(); form.reset(); updateAccount(); notify(state.authMode === 'register' ? 'Account created.' : 'Signed in.');
      if (state.user.role === 'admin') location.hash = '#admin'; else location.hash = '#dashboard';
    } catch (error) { $('#auth-feedback').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#account-badge').addEventListener('click', () => { location.hash = '#dashboard'; });
  $('#notifications-open').addEventListener('click', () => { if (!state.user) return; location.hash = '#dashboard'; $('#my-notifications').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('#sign-out').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); state.user = null; state.csrf = null; state.bookings = []; updateAccount(); notify('Signed out.'); location.hash = '#home'; } catch (error) { notify(error.message, true); } });
  $('#search-input').addEventListener('input', applyFilters); $('#sport-filter').addEventListener('change', applyFilters); $('#type-filter').addEventListener('change', applyFilters);
  $('#reset-filters').addEventListener('click', () => { $('#search-input').value = ''; $('#sport-filter').value = ''; $('#type-filter').value = ''; applyFilters(); });
  $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    try { const data = await api('/api/my/profile', { method: 'POST', body: JSON.stringify({ displayName: form.elements.displayName.value, sportsInterests: form.elements.sportsInterests.value.split(',').map(item => item.trim()).filter(Boolean) }) }); state.user = data.user; updateAccount(); notify('Profile saved.'); }
    catch (error) { notify(error.message, true); }
  });
  $('#mark-notifications-read').addEventListener('click', async () => {
    try { await api('/api/my/notifications/read', { method: 'POST', body: '{}' }); await loadDashboardData(); }
    catch (error) { notify(error.message, true); }
  });
  $('#new-event').addEventListener('click', () => { const form = $('#event-form'); form.reset(); form.elements.id.value = ''; $('#event-editor-title').textContent = 'Create event'; $('#event-form-feedback').textContent = ''; $('#event-editor').classList.remove('hidden'); $('#event-editor').scrollIntoView({ behavior: 'smooth' }); });
  $('#event-editor-close').addEventListener('click', () => $('#event-editor').classList.add('hidden'));
  $('#event-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    if (form.elements.status.value === 'cancelled' && !form.dataset.confirmed) {
      confirmAction('Cancel this event?', 'The event will stop accepting bookings. People with active bookings will receive an in-app update.', async () => { form.dataset.confirmed = 'true'; await submitEvent(form); delete form.dataset.confirmed; });
      return;
    }
    submitEvent(form);
  });
  $('#menu-toggle').addEventListener('click', () => { const open = $('.main-nav').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
  $('#confirm-cancel').addEventListener('click', () => { state.confirmAction = null; $('#confirm-dialog').close(); });
  $('#confirm-accept').addEventListener('click', async () => { const action = state.confirmAction; state.confirmAction = null; $('#confirm-dialog').close(); if (action) try { await action(); } catch (error) { notify(error.message, true); } });
  $('#confirm-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) $('#confirm-dialog').close(); });
}

async function init() {
  bind();
  try { await refreshSession(); } catch { state.user = null; state.csrf = null; }
  updateAccount(); await loadEvents(); syncHash();
}
init();
