// Google Wallet: builds a "Save to Google Wallet" link (a signed JWT that
// carries the loyalty class and object, so nothing is created in advance).
import jwt from 'jsonwebtoken';
import { settings } from './settings.js';
import { colours } from './images.js';
import { LABELS } from './input.js';
import { currentMessage } from './messages.js';

const safe = s => s.replace(/[^\w.-]/g, '_');

export function buildGoogleSaveUrl({ card, customer, lang }, origin) {
  const L = LABELS[lang];
  const { issuerId, serviceAccount } = settings.google;
  const { bg, ink } = colours(card);
  const en = lang === 'en';
  const title = (en && card.titleEn) || card.title;
  const reward = (en && card.rewardEn) || card.reward;
  const img = (path, q) => ({ sourceUri: { uri: `${settings.publicUrl}${path}?${new URLSearchParams(q)}` } });
  // Google fetches images by URL, so the look travels as query parameters.
  const look = { color: bg, ink, stamp: card.stamp, style: card.style, type: card.type, strip: card.strip };

  const classId = `${issuerId}.${safe('timbro_' + card.id)}`;
  const loyaltyClass = {
    id: classId,
    issuerName: card.business,
    programName: title,
    programLogo: img('/img/icon', look),
    hexBackgroundColor: bg,
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'IT'
  };
  const loyaltyObject = {
    id: `${issuerId}.${safe(`timbro_${card.id}_${customer.id}`)}`,
    classId,
    state: 'ACTIVE',
    accountId: customer.id,
    accountName: customer.name,
    loyaltyPoints: { label: L.points, balance: { string: `${customer.stamps}/${card.stampsNeeded}` } },
    textModulesData: [{ id: 'reward', header: L.reward, body: reward }, { id: 'how', header: L.how, body: L.howText(card.stampsNeeded) }],
    barcode: { type: 'QR_CODE', value: customer.id, alternateText: customer.id },
    heroImage: img('/img/strip', { ...look, need: card.stampsNeeded, have: customer.stamps })
  };
  // The café's own message ("almost there", "reward ready") on the pass.
  const news = currentMessage(card, customer, lang);
  if (news) loyaltyObject.messages = [{ id: 'news', header: card.business, body: news }];
  const token = jwt.sign({
    iss: serviceAccount.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: origin ? [origin] : [],
    payload: { loyaltyClasses: [loyaltyClass], loyaltyObjects: [loyaltyObject] }
  }, serviceAccount.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
