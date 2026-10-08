// Smoke test with throwaway certificates and keys (made with openssl).
// Checks that a .pkpass bundle and a Google save link are built correctly.
// Real Wallet apps will only accept passes signed with your real certificates.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timbro-wallet-'));
const run = cmd => execSync(cmd, { cwd: dir, stdio: 'pipe' });
run('openssl req -x509 -newkey rsa:2048 -nodes -keyout wwdr.key -out wwdr.pem -days 2 -subj "/CN=Test WWDR"');
run('openssl req -newkey rsa:2048 -nodes -keyout signer.key -out signer.csr -subj "/CN=Pass Type ID: pass.test.timbro"');
run('openssl x509 -req -in signer.csr -CA wwdr.pem -CAkey wwdr.key -CAcreateserial -out signer.pem -days 2');
const googleKey = fs.readFileSync(path.join(dir, 'wwdr.key'), 'utf8');
fs.writeFileSync(path.join(dir, 'sa.json'), JSON.stringify({ client_email: 'wallet@test.iam.gserviceaccount.com', private_key: googleKey }));

Object.assign(process.env, {
  APPLE_PASS_TYPE_ID: 'pass.test.timbro', APPLE_TEAM_ID: 'TEAM123456',
  APPLE_SIGNER_CERT: path.join(dir, 'signer.pem'), APPLE_SIGNER_KEY: path.join(dir, 'signer.key'), APPLE_WWDR_CERT: path.join(dir, 'wwdr.pem'),
  GOOGLE_ISSUER_ID: '3388000000000000000', GOOGLE_SERVICE_ACCOUNT: path.join(dir, 'sa.json'), PUBLIC_URL: 'https://wallet.example'
});
const { readPassRequest } = await import('../input.js');
const { buildApplePass } = await import('../apple.js');
const { buildGoogleSaveUrl } = await import('../google.js');
const { default: jwt } = await import('jsonwebtoken');

const req = readPassRequest({
  lang: 'it',
  card: { id: 'the-coffee', business: 'The Coffee', title: 'Carta caffè', reward: 'un caffè gratis', stampsNeeded: 10, color: '#FFFFFF', ink: '#2B32FF', icon: 'cup' },
  customer: { id: 'k7m2qx', name: 'Giulia', stamps: 3 }
});
assert.equal(req.customer.id, 'K7M2QX');
assert.throws(() => readPassRequest({ card: { id: 'x' }, customer: { id: 'bad' } }));

// Apple
const pkpass = await buildApplePass(req);
const out = path.join(dir, 'test.pkpass');
fs.writeFileSync(out, pkpass);
const list = execSync(`unzip -Z1 ${out}`).toString().trim().split('\n').sort();
for (const f of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'strip.png', 'strip@2x.png', 'strip@3x.png'])
  assert.ok(list.includes(f), `missing ${f}`);
const pass = JSON.parse(execSync(`unzip -p ${out} pass.json`).toString());
assert.equal(pass.storeCard.headerFields[0].value, '3/10');
assert.equal(pass.barcodes[0].message, 'K7M2QX');
assert.equal(pass.logoText, 'The Coffee');
console.log('apple ok:', list.join(', '));

// Google
const url = buildGoogleSaveUrl(req, 'https://timbro.example');
assert.ok(url.startsWith('https://pay.google.com/gp/v/save/'));
const claims = jwt.decode(url.split('/').pop());
assert.equal(claims.typ, 'savetowallet');
assert.equal(claims.payload.loyaltyObjects[0].barcode.value, 'K7M2QX');
assert.equal(claims.payload.loyaltyObjects[0].loyaltyPoints.balance.string, '3/10');
console.log('google ok:', claims.payload.loyaltyObjects[0].id);

// The café's own messages: "almost there" replaces the plain stamps alert, and the café's location goes on the pass.
const near = readPassRequest({
  lang: 'it',
  card: { id: 'orsonero', business: 'Orsonero', title: 'Carta', reward: 'un caffè a scelta', stampsNeeded: 8,
    messages: { close: { on: true, left: 2, it: 'Dai {name}, ancora {left}!' }, near: { on: true, lat: 45.4781, lng: 9.2061 }, evil: { on: true } } },
  customer: { id: 'abc123', name: 'Marta', stamps: 6 }
});
assert.equal(near.card.messages.evil, undefined);
const passJson = buf => { const f = path.join(dir, 'm.pkpass'); fs.writeFileSync(f, buf); return JSON.parse(execSync(`unzip -p ${f} pass.json`).toString()); };
const p2 = passJson(await buildApplePass(near));
assert.equal(p2.storeCard.backFields[0].value, 'Dai Marta, ancora 2 timbri!');
assert.equal(p2.storeCard.backFields[0].changeMessage, '%@');
assert.equal(p2.storeCard.headerFields[0].changeMessage, undefined);
assert.deepEqual(p2.locations[0], { latitude: 45.4781, longitude: 9.2061, relevantText: 'Sei vicino a Orsonero: ancora 2 timbri per un caffè a scelta.' });
// Far from the reward: a quiet line and the usual "Stamps: %@" alert; a server notice (reminder) wins.
const far = { ...near, customer: { ...near.customer, stamps: 1 } };
const p3 = passJson(await buildApplePass(far));
assert.equal(p3.storeCard.backFields[0].value, 'Un timbro a ogni visita.'); assert.equal(p3.storeCard.headerFields[0].changeMessage, 'Timbri: %@');
const p4 = passJson(await buildApplePass({ ...far, notice: 'Ci manchi!' }));
assert.equal(p4.storeCard.backFields[0].value, 'Ci manchi!');
const g2 = jwt.decode(buildGoogleSaveUrl(near, 'https://timbro.example').split('/').pop());
assert.equal(g2.payload.loyaltyObjects[0].messages[0].body, 'Dai Marta, ancora 2 timbri!');
console.log('messages ok: almost-there text, location, reminder notice, Google message');
