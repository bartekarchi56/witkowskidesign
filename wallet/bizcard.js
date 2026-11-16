// Business cards (Bartosz's and the ones sold, PEOPLE below) as an Apple Wallet pass ("generic" style): GET /bizcard.pkpass,
// a Google Wallet save link: GET /bizcard-google
// and a contact file: GET /bizcard.vcf. The page /wizytowka/ on the website links to both.
// Change the details here; the card in people's Wallets updates next time it is opened anew.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';
import jwt from 'jsonwebtoken';
import { settings } from './settings.js';

const TIMBRO_TEXT = 'Karty lojalnościowe w Apple i Google Wallet dla kawiarni, piekarni i sklepów. Bez aplikacji i bez papieru.';
const LAMARE = {
  company: 'LA MARE Sp. z o.o.', web: 'https://lamare.pl', dir: 'lamare', page: 'lamare',
  bg: [2, 20, 34], fg: [250, 250, 248], label: [255, 174, 58], hex: '#021422',
  logo: 'lamare-white.png', googleLogo: 'lamare-icon.png', hero: 'lamare-hero.png',
  about: ['La Mare Houseboats', 'Pływające domy na wodzie: producent houseboatów.']
};
// Each card: /bizcard/<id>.pkpass, /bizcard/<id>.vcf, /bizcard/<id>/google (Bartek's also at the old /bizcard.* paths).
export const PEOPLE = {
  'bartosz-witkowski': {
    name: 'Bartosz Witkowski', role: 'Założyciel Timbro', company: 'abit.', phone: '+48 530 340 988', email: 'abit@witkowskidesign.com',
    web: 'https://timbro.witkowskidesign.com', instagram: '@timbro.loyalty', city: 'Bydgoszcz · Milano',
    dir: '', page: '', bg: [27, 27, 25], fg: [250, 250, 248], label: [150, 150, 146], hex: '#1B1B19',
    googleLogo: 'abit-icon.png', hero: 'abit-hero.png', about: ['Timbro', TIMBRO_TEXT]
  },
  'witold-witkowski': { ...LAMARE, name: 'Witold Witkowski', role: 'CEO', phone: '+48 516 005 998', email: 'biuro@lamare.pl' },
  'michal-witkowski': { ...LAMARE, name: 'Michał Witkowski', role: 'Sprzedawca', phone: '+48 531 005 988', email: 'biuro@lamare.pl' }
};
export const ME = PEOPLE['bartosz-witkowski'];
const person = id => PEOPLE[id] || ME;
const rgb = c => `rgb(${c.join(', ')})`;
const vcfUrl = id => id === 'bartosz-witkowski' ? `${settings.publicUrl}/bizcard.vcf` : `${settings.publicUrl}/bizcard/${id}.vcf`;
const ascii = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bizcard');
const file = (dir, n) => fs.readFileSync(path.join(DIR, dir, n));

export function vcard(id = 'bartosz-witkowski') {
  const ME = person(id);
  const [first, ...rest] = ME.name.split(' ');
  return ['BEGIN:VCARD', 'VERSION:3.0', `N:${rest.join(' ')};${first};;;`, `FN:${ME.name}`, `ORG:${ME.company}`, `TITLE:${ME.role}`,
    `TEL;TYPE=CELL:${ME.phone.replace(/\s/g, '')}`, `EMAIL;TYPE=WORK:${ME.email}`, `URL:${ME.web}`,
    ...(ME.instagram ? [`X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/${ME.instagram.replace('@', '')}`] : []), 'END:VCARD', ''].join('\r\n');
}

export async function buildBizcard(id = 'bartosz-witkowski') {
  const ME = person(id);
  const tel = ME.phone.replace(/\s/g, '');
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: settings.apple.passTypeIdentifier,
    teamIdentifier: settings.apple.teamIdentifier,
    serialNumber: `bizcard-${id}`,
    organizationName: ME.name,
    description: `${ME.name} · ${ME.company}`,
    backgroundColor: rgb(ME.bg),
    foregroundColor: rgb(ME.fg),
    labelColor: rgb(ME.label),
    generic: {
      primaryFields: [{ key: 'name', label: ME.role.toUpperCase(), value: ME.name }],
      secondaryFields: [{ key: 'company', label: 'FIRMA', value: ME.company }],
      auxiliaryFields: [
        { key: 'phone', label: 'TELEFON', value: ME.phone },
        { key: 'email', label: 'E-MAIL', value: ME.email, textAlignment: 'PKTextAlignmentRight' }
      ],
      backFields: [
        { key: 'b-phone', label: 'Telefon', value: ME.phone, attributedValue: `<a href="tel:${tel}">${ME.phone}</a>` },
        { key: 'b-email', label: 'E-mail', value: ME.email, attributedValue: `<a href="mailto:${ME.email}">${ME.email}</a>` },
        { key: 'b-web', label: 'Strona', value: ME.web, attributedValue: `<a href="${ME.web}">${ME.web.replace('https://', '')}</a>` },
        { key: 'b-company', label: 'Firma', value: ME.company },
        ...(ME.instagram ? [{ key: 'b-ig', label: 'Instagram', value: ME.instagram }] : []),
        ...(ME.city ? [{ key: 'b-where', label: 'Gdzie', value: ME.city }] : []),
        { key: 'b-what', label: ME.about[0], value: ME.about[1] }
      ]
    },
    // Scanning the code saves the contact.
    barcodes: [{ format: 'PKBarcodeFormatQR', message: vcfUrl(id), messageEncoding: 'iso-8859-1' }]
  };
  const files = { 'pass.json': Buffer.from(JSON.stringify(passJson)) };
  for (const n of ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png']) files[n] = file(ME.dir, n);
  const { signerCert, signerKey, signerKeyPassphrase, wwdr } = settings.apple;
  return new PKPass(files, { signerCert, signerKey, signerKeyPassphrase, wwdr }).getAsBuffer();
}

// Google Wallet: a "generic" pass in a signed save link, nothing is created in advance.
// The logo and banner are public files of the website (wizytowka/).
const SITE = 'https://timbro.witkowskidesign.com/wizytowka';
export function bizcardGoogleUrl(origin, id = 'bartosz-witkowski') {
  const ME = person(id);
  const site = ME.page ? `${SITE}/${ME.page}` : SITE;
  const { issuerId, serviceAccount } = settings.google;
  const objectId = `${issuerId}.bizcard_${ascii(id).replace(/-/g, '_')}`;
  const img = (n, d) => ({ sourceUri: { uri: `${site}/${n}` }, contentDescription: { defaultValue: { language: 'pl', value: d } } });
  const genericObject = {
    id: objectId, classId: `${issuerId}.bizcard`, state: 'ACTIVE',
    cardTitle: { defaultValue: { language: 'pl', value: ME.company } },
    subheader: { defaultValue: { language: 'pl', value: ME.role } },
    header: { defaultValue: { language: 'pl', value: ME.name } },
    hexBackgroundColor: ME.hex,
    logo: img(ME.googleLogo, ME.company),
    heroImage: img(ME.hero, ME.company),
    textModulesData: [
      { id: 'phone', header: 'Telefon', body: ME.phone },
      { id: 'email', header: 'E-mail', body: ME.email },
      ...(ME.instagram ? [{ id: 'ig', header: 'Instagram', body: ME.instagram }] : []),
      { id: 'about', header: ME.about[0], body: ME.about[1] }
    ],
    linksModuleData: { uris: [
      { id: 'tel', uri: `tel:${ME.phone.replace(/\s/g, '')}`, description: 'Zadzwoń' },
      { id: 'mail', uri: `mailto:${ME.email}`, description: 'Napisz e-mail' },
      { id: 'web', uri: ME.web, description: ME.web.replace('https://', '') }
    ] },
    barcode: { type: 'QR_CODE', value: vcfUrl(id) }
  };
  const token = jwt.sign({
    iss: serviceAccount.client_email, aud: 'google', typ: 'savetowallet', origins: origin ? [origin] : [],
    payload: { genericClasses: [{ id: `${issuerId}.bizcard` }], genericObjects: [genericObject] }
  }, serviceAccount.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
