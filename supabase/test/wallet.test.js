// Live Apple Wallet updates, end to end: the wallet server (wallet/) with
// throwaway certificates, talking to the real database functions through
// fake-supabase.js. Needs the local Postgres (see README); APNs itself is not
// reached (the push goes to a closed port), only everything around it.
//   node wallet.test.js
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { pool, call } from './db.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timbro-live-'));
const run = cmd => execSync(cmd, { cwd: dir, stdio: 'pipe' });
run('openssl req -x509 -newkey rsa:2048 -nodes -keyout wwdr.key -out wwdr.pem -days 2 -subj "/CN=Test WWDR"');
run('openssl req -newkey rsa:2048 -nodes -keyout signer.key -out signer.csr -subj "/CN=Pass Type ID: pass.test.timbro"');
run('openssl x509 -req -in signer.csr -CA wwdr.pem -CAkey wwdr.key -CAcreateserial -out signer.pem -days 2');

const SB = 54399, WAL = 8799, ORIGIN = 'http://site.test', PT = 'pass.test.timbro';
const kids = [];
const start = (file, env, cwd) => { const k = spawn('node', [file], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); kids.push(k); return k; };
start('fake-supabase.js', { PORT: SB }, path.dirname(new URL(import.meta.url).pathname));
start('server.js', {
  PORT: WAL, PUBLIC_URL: 'https://wallet.test', ALLOWED_ORIGINS: ORIGIN, APPLE_PASS_TYPE_ID: PT, APPLE_TEAM_ID: 'TEAM123456',
  APPLE_SIGNER_CERT: path.join(dir, 'signer.pem'), APPLE_SIGNER_KEY: path.join(dir, 'signer.key'), APPLE_WWDR_CERT: path.join(dir, 'wwdr.pem'),
  SUPABASE_URL: `http://localhost:${SB}`, SUPABASE_ANON_KEY: 'anon', APNS_HOST: 'https://127.0.0.1:9'
}, path.join(path.dirname(new URL(import.meta.url).pathname), '../../wallet'));
const W = (p, opts = {}) => fetch(`http://localhost:${WAL}${p}`, opts);
for (let i = 0; i < 50; i++) { try { if ((await W('/health')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 200)); }

let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const passJson = buf => { const f = path.join(dir, 'p.pkpass'); fs.writeFileSync(f, buf); return JSON.parse(execSync(`unzip -p ${f} pass.json`)); };
try {
  // A café with a card, a till phone and a customer.
  const u = (await pool.query(`insert into auth.users (email) values ('live-${Date.now()}@test.local') returning id`)).rows[0].id;
  const owner = { role: 'authenticated', sub: u }, id = 'live-' + Date.now().toString(36);
  await call(owner, 'owner_save_card', { p_card: { id, business: 'Bar Live', title: 'Carta', reward: 'un caffè', stampsNeeded: 5, lang: 'it' } });
  const dev = await call({ role: 'anon' }, 'device_link', { p_code: (await call(owner, 'owner_link_code')).code, p_name: 'Cassa' });
  const me = await call({ role: 'anon' }, 'join_card', { p_card_id: id, p_name: 'Giulia Rossi', p_email: 'g@test.it', p_phone: '+393331234567', p_birth: '1995-01-01' });
  const serial = `${id}-${me.id}`, auth = { authorization: `ApplePass ${me.secret}` };

  // Adding the pass: it carries the web service address and the customer's secret as its token.
  const add = await W('/apple', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'it', card: { id }, customer: { id: me.id, secret: me.secret } }) });
  assert.equal(add.status, 200, await add.clone().text());
  const p1 = passJson(Buffer.from(await add.arrayBuffer()));
  assert.equal(p1.webServiceURL, 'https://wallet.test/passkit'); assert.equal(p1.authenticationToken, me.secret);
  assert.equal(p1.serialNumber, serial); assert.equal(p1.storeCard.headerFields[0].value, '0/5');
  ok('a database card\'s pass carries the update address and its own token');

  // The phone registers; a wrong token is refused.
  const reg = (token, body = { pushToken: 'ab'.repeat(32) }) => W(`/passkit/v1/devices/dev1/registrations/${PT}/${serial}`, { method: 'POST', headers: { authorization: `ApplePass ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await reg('0'.repeat(48))).status, 401);
  assert.equal((await reg(me.secret)).status, 201);
  assert.equal((await reg(me.secret)).status, 200);
  const list = await W(`/passkit/v1/devices/dev1/registrations/${PT}?passesUpdatedSince=0`);
  assert.equal(list.status, 200); const tag = (await list.json()).lastUpdated;
  assert.equal((await W(`/passkit/v1/devices/dev1/registrations/${PT}?passesUpdatedSince=${tag}`)).status, 204);
  ok('Wallet registers the pass and lists it as changed only when it changed');

  // A stamp at the till: the till wakes the phone, the phone gets the new pass.
  await new Promise(r => setTimeout(r, 20));
  await call({ role: 'anon' }, 'stamper_stamp', { p_token: dev.token, p_code: me.id, p_delta: 1 });
  const note = await (await W('/notify', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: JSON.stringify({ token: dev.token, code: me.id }) })).json();
  assert.equal(note.phones, 1);
  assert.equal((await W(`/passkit/v1/devices/dev1/registrations/${PT}?passesUpdatedSince=${tag}`)).status, 200);
  const fresh = await W(`/passkit/v1/passes/${PT}/${serial}`, { headers: auth });
  assert.equal(fresh.status, 200);
  assert.equal(passJson(Buffer.from(await fresh.arrayBuffer())).storeCard.headerFields[0].value, '1/5');
  assert.equal((await W(`/passkit/v1/passes/${PT}/${serial}`, { headers: { authorization: 'ApplePass ' + '0'.repeat(48) } })).status, 401);
  assert.equal((await W('/notify', { method: 'POST', headers: { origin: 'http://evil.test' }, body: '{}' })).status, 403);
  ok('after a stamp the till wakes the phone and Wallet downloads the pass with the new stamp');

  // Removing the pass.
  assert.equal((await W(`/passkit/v1/devices/dev1/registrations/${PT}/${serial}`, { method: 'DELETE', headers: auth })).status, 200);
  assert.equal(((await (await W('/notify', { method: 'POST', headers: { origin: ORIGIN }, body: JSON.stringify({ token: dev.token, code: me.id }) })).json()).phones), 0);
  ok('removing the pass from Wallet stops the updates');
  console.log(`\nAll ${n} checks passed.`);
} finally {
  kids.forEach(k => k.kill()); await pool.end();
}
