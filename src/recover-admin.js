import { createInterface } from 'node:readline';
import { db } from './db.js';
import { hashPassword } from './auth.js';

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, value => { rl.close(); resolve(value.trim()); }));
}

function askHidden(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) return Promise.reject(new Error('Run recovery in an interactive terminal so the password can be entered without echo.'));
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
  const admins = db.prepare("SELECT id,email,display_name FROM users WHERE role='admin' ORDER BY email").all();
  if (admins.length === 0) throw new Error('No administrator accounts exist. Run npm run admin:bootstrap to create the first admin.');
  console.log('Administrator accounts:');
  admins.forEach((admin, index) => console.log(`${index + 1}. ${admin.email} (${admin.display_name})`));

  const selected = await ask('Enter the number of the account to reset: ');
  if (!/^\d+$/.test(selected) || Number(selected) < 1 || Number(selected) > admins.length) throw new Error('Choose a number from the list.');
  const admin = admins[Number(selected) - 1];
  const confirmation = await ask(`Type RESET to set a new password for ${admin.email}: `);
  if (confirmation !== 'RESET') throw new Error('Cancelled; no account was changed.');
  const password = await askHidden('New administrator password (12+ characters): ');
  const passwordHash = await hashPassword(password);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("UPDATE users SET password_hash=? WHERE id=? AND role='admin'").run(passwordHash, admin.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(admin.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  console.log(`Password reset for ${admin.email}. Existing sessions for this account were revoked.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
