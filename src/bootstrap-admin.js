import { createInterface } from 'node:readline';
import { db } from './db.js';
import { hashPassword, newId } from './auth.js';

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, value => { rl.close(); resolve(value.trim()); }));
}

function askHidden(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) return Promise.reject(new Error('Run this bootstrap in an interactive terminal so the password can be entered without echo.'));
  return new Promise((resolve, reject) => {
    process.stdout.write(label);
    process.stdin.setRawMode(true); process.stdin.resume();
    let value = '';
    const onData = chunk => {
      const key = chunk.toString('utf8');
      if (key === '\u0003') { cleanup(); reject(new Error('Cancelled.')); return; }
      if (key === '\r' || key === '\n') { process.stdout.write('\n'); cleanup(); resolve(value); return; }
      if (key === '\u007f' || key === '\b') { value = value.slice(0, -1); return; }
      if (key.length === 1 && key >= ' ' && key <= '~') value += key;
    };
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); };
    process.stdin.on('data', onData);
  });
}

try {
  const admins = Number(db.prepare("SELECT COUNT(*) count FROM users WHERE role='admin'").get().count);
  if (admins > 0) throw new Error('An administrator already exists. Ask an existing administrator to provision another account through a reviewed workflow.');
  const email = await ask('Administrator email: ');
  const displayName = await ask('Administrator display name: ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  if (displayName.length < 2 || displayName.length > 80) throw new Error('Display name must be 2 to 80 characters.');
  const password = await askHidden('Administrator password (12+ characters): ');
  const passwordHash = await hashPassword(password);
  db.prepare("INSERT INTO users(id,email,display_name,password_hash,role) VALUES(?,?,?,?, 'admin')")
    .run(newId(), email.toLowerCase(), displayName, passwordHash);
  console.log('First administrator created. Sign in through the app; keep this terminal session private.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
