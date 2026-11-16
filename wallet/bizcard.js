// Bartosz's business card as an Apple Wallet pass ("generic" style): GET /bizcard.pkpass,
// a Google Wallet save link: GET /bizcard-google
// and a contact file: GET /bizcard.vcf. The page /wizytowka/ on the website links to both.
// Change the details here; the card in people's Wallets updates next time it is opened anew.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';
import jwt from 'jsonwebtoken';
import { settings } from './settings.js';

export const ME = {
  name: 'Bartosz Witkowski',
  role: 'Założyciel Timbro',
  company: 'abit.',
  phone: '+48 530 340 988',
  email: 'abit@witkowskidesign.com',
  web: 'https://timbro.witkowskidesign.com',
  instagram: '@timbro.loyalty',
  city: 'Bydgoszcz · Milano'
};

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bizcard');
const file = n => fs.readFileSync(path.join(DIR, n));

export function vcard() {
  const [first, ...rest] = ME.name.split(' ');
  return ['BEGIN:VCARD', 'VERSION:3.0', `N:${rest.join(' ')};${first};;;`, `FN:${ME.name}`, `ORG:${ME.company}`, `TITLE:${ME.role}`,
    `TEL;TYPE=CELL:${ME.phone.replace(/\s/g, '')}`, `EMAIL;TYPE=WORK:${ME.email}`, `URL:${ME.web}`,
    `X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/${ME.instagram.replace('@', '')}`, 'END:VCARD', ''].join('\r\n');
}

export async function buildBizcard() {
  const tel = ME.phone.replace(/\s/g, '');
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: settings.apple.passTypeIdentifier,
    teamIdentifier: settings.apple.teamIdentifier,
    serialNumber: 'bizcard-bartosz-witkowski',
    organizationName: ME.name,
    description: `${ME.name} · ${ME.company}`,
    backgroundColor: 'rgb(27, 27, 25)',
    foregroundColor: 'rgb(250, 250, 248)',
    labelColor: 'rgb(150, 150, 146)',
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
        { key: 'b-ig', label: 'Instagram', value: ME.instagram },
        { key: 'b-where', label: 'Gdzie', value: ME.city },
        { key: 'b-what', label: 'Timbro', value: 'Karty lojalnościowe w Apple i Google Wallet dla kawiarni, piekarni i sklepów. Bez aplikacji i bez papieru.' }
      ]
    },
    // Scanning the code saves the contact.
    barcodes: [{ format: 'PKBarcodeFormatQR', message: `${settings.publicUrl}/bizcard.vcf`, messageEncoding: 'iso-8859-1' }]
  };
  const files = { 'pass.json': Buffer.from(JSON.stringify(passJson)) };
  for (const n of ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png']) files[n] = file(n);
  const { signerCert, signerKey, signerKeyPassphrase, wwdr } = settings.apple;
  return new PKPass(files, { signerCert, signerKey, signerKeyPassphrase, wwdr }).getAsBuffer();
}

// Google Wallet: a "generic" pass in a signed save link, nothing is created in advance.
// The logo and banner are public files of the website (wizytowka/).
const SITE = 'https://timbro.witkowskidesign.com/wizytowka';
export function bizcardGoogleUrl(origin) {
  const { issuerId, serviceAccount } = settings.google;
  const id = `${issuerId}.bizcard_bartosz_witkowski`;
  const img = (n, d) => ({ sourceUri: { uri: `${SITE}/${n}` }, contentDescription: { defaultValue: { language: 'pl', value: d } } });
  const genericObject = {
    id, classId: `${issuerId}.bizcard`, state: 'ACTIVE',
    cardTitle: { defaultValue: { language: 'pl', value: ME.company } },
    subheader: { defaultValue: { language: 'pl', value: ME.role } },
    header: { defaultValue: { language: 'pl', value: ME.name } },
    hexBackgroundColor: '#1B1B19',
    logo: img('abit-icon.png', ME.company),
    heroImage: img('abit-hero.png', ME.company),
    textModulesData: [
      { id: 'phone', header: 'Telefon', body: ME.phone },
      { id: 'email', header: 'E-mail', body: ME.email },
      { id: 'ig', header: 'Instagram', body: ME.instagram },
      { id: 'timbro', header: 'Timbro', body: 'Karty lojalnościowe w Apple i Google Wallet dla kawiarni, piekarni i sklepów. Bez aplikacji i bez papieru.' }
    ],
    linksModuleData: { uris: [
      { id: 'tel', uri: `tel:${ME.phone.replace(/\s/g, '')}`, description: 'Zadzwoń' },
      { id: 'mail', uri: `mailto:${ME.email}`, description: 'Napisz e-mail' },
      { id: 'web', uri: ME.web, description: 'timbro.witkowskidesign.com' }
    ] },
    barcode: { type: 'QR_CODE', value: `${settings.publicUrl}/bizcard.vcf` }
  };
  const token = jwt.sign({
    iss: serviceAccount.client_email, aud: 'google', typ: 'savetowallet', origins: origin ? [origin] : [],
    payload: { genericClasses: [{ id: `${issuerId}.bizcard` }], genericObjects: [genericObject] }
  }, serviceAccount.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
