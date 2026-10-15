// Google Wallet: builds a "Save to Google Wallet" link (a signed JWT that
// carries the loyalty class and object, so nothing is created in advance),
// and after each stamp updates the saved object through the Google Wallet API.
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { settings } from './settings.js';
import { colours } from './images.js';
import { LABELS } from './input.js';
import { currentMessage } from './messages.js';

const safe = s => s.replace(/[^\w.-]/g, '_');

// `live`: the card is in the database, so Google can fetch its images (with the café's own
// stamp and background art) by card id. Demo cards send their look in the image address.
function passParts({ card, customer, lang }, live) {
  const L = LABELS[lang];
  const { issuerId } = settings.google;
  const { bg, ink } = colours(card);
  const en = lang === 'en';
  const title = (en && card.titleEn) || card.title;
  const reward = (en && card.rewardEn) || card.reward;
  const img = (path, q) => ({ sourceUri: { uri: `${settings.publicUrl}${path}?${new URLSearchParams(q)}` } });
  const look = live
    ? { card: card.id, v: card.updatedAt || 0 }
    : { color: bg, ink, stamp: card.stamp, style: card.style, type: card.type, strip: card.strip };

  const classId = `${issuerId}.${safe('timbro_' + card.id)}`;
  const loyaltyClass = {
    id: classId,
    issuerName: card.business,
    programName: title,
    programLogo: img('/img/icon', look),
    hexBackgroundColor: bg,
    reviewStatus: 'UNDER_REVIEW',
    countryCode: card.lang === 'pl' ? 'PL' : 'IT'
  };
  const object = {
    loyaltyPoints: { label: L.points, balance: { string: `${customer.stamps}/${card.stampsNeeded}` } },
    textModulesData: [{ id: 'reward', header: L.reward, body: reward }, { id: 'how', header: L.how, body: L.howText(card.stampsNeeded) }],
    heroImage: img('/img/strip', { ...look, need: card.stampsNeeded, have: customer.stamps }),
    messages: []
  };
  // The café's own message ("almost there", "reward ready") on the pass. A new text
  // gets a new id, so Google shows it as a notification once.
  const news = currentMessage(card, customer, lang);
  if (news) object.messages = [{ id: 'news_' + createHash('sha1').update(news).digest('hex').slice(0, 10), header: card.business, body: news, messageType: 'TEXT_AND_NOTIFY' }];
  const loyaltyObject = {
    id: `${issuerId}.${safe(`timbro_${card.id}_${customer.id}`)}`,
    classId,
    state: 'ACTIVE',
    accountId: customer.id,
    accountName: customer.name,
    barcode: { type: 'QR_CODE', value: customer.id, alternateText: customer.id },
    ...object
  };
  return { loyaltyClass, loyaltyObject, object };
}

export function buildGoogleSaveUrl(data, origin, live = false) {
  const { serviceAccount } = settings.google;
  const { loyaltyClass, loyaltyObject } = passParts(data, live);
  const token = jwt.sign({
    iss: serviceAccount.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: origin ? [origin] : [],
    payload: { loyaltyClasses: [loyaltyClass], loyaltyObjects: [loyaltyObject] }
  }, serviceAccount.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// An access token for the Google Wallet API, from the service account (kept until it expires).
let cached = { token: '', until: 0 };
async function accessToken() {
  if (cached.until > Date.now() + 60000) return cached.token;
  const { serviceAccount, tokenUrl } = settings.google;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({ iss: serviceAccount.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: tokenUrl, iat: now, exp: now + 3600 }, serviceAccount.private_key, { algorithm: 'RS256' });
  const r = await fetch(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!r.ok) throw new Error(`Google token: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  cached = { token: j.access_token, until: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

// After a stamp: new stamp count, picture and message on the customer's saved card.
// Returns the API's status: 200 updated, 404 the customer never saved it to Google Wallet.
export async function updateGoogleObject(data, live = true) {
  const { loyaltyObject, object } = passParts(data, live);
  const r = await fetch(`${settings.google.api}/walletobjects/v1/loyaltyObject/${encodeURIComponent(loyaltyObject.id)}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(object)
  });
  return r.status;
}
