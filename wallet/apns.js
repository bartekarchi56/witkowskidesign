// Tells iPhones that a pass changed, so Wallet downloads the new version from
// this server (Apple's PassKit web service). Uses the Pass Type ID certificate
// over HTTP/2; the push itself is empty, as Apple asks for pass updates.
import http2 from 'node:http2';
import { settings } from './settings.js';

const HOST = process.env.APNS_HOST || 'https://api.push.apple.com';

export function pushPassUpdate(tokens) {
  const list = [...new Set((tokens || []).filter(t => /^[0-9a-f]{20,200}$/i.test(t)))];
  if (!list.length) return Promise.resolve([]);
  const { signerCert: cert, signerKey: key, signerKeyPassphrase: passphrase, passTypeIdentifier } = settings.apple;
  return new Promise(done => {
    const client = http2.connect(HOST, { cert, key, passphrase });
    const results = [];
    let left = list.length;
    const finish = () => { if (--left === 0) { client.close(); done(results); } };
    client.on('error', err => { results.push({ error: err.message }); client.destroy(); done(results); });
    for (const token of list) {
      const req = client.request({ ':method': 'POST', ':path': `/3/device/${token}`, 'apns-topic': passTypeIdentifier, 'content-type': 'application/json' });
      req.on('response', h => { results.push({ token: token.slice(0, 8), status: h[':status'] }); });
      req.on('error', err => { results.push({ token: token.slice(0, 8), error: err.message }); finish(); });
      req.on('close', finish);
      req.end('{}');
    }
  });
}
