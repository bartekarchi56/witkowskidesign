// Bartek's business card as an Apple Wallet pass ("generic" style): GET /bizcard.pkpass
// and a contact file: GET /bizcard.vcf. The page /wizytowka/ on the website links to both.
// Change the details here; the card in people's Wallets updates next time it is opened anew.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';
import { settings } from './settings.js';

export const ME = {
  name: 'Bartek Witkowski',
  role: 'Founder',
  company: 'abit. · Timbro',
  phone: '+48 530 340 988',
  email: 'timbro@witkowskidesign.com',
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
    serialNumber: 'bizcard-bartek-witkowski',
    organizationName: ME.name,
    description: `${ME.name} · ${ME.company}`,
    backgroundColor: 'rgb(27, 27, 25)',
    foregroundColor: 'rgb(250, 250, 248)',
    labelColor: 'rgb(150, 150, 146)',
    generic: {
      primaryFields: [{ key: 'name', label: ME.role.toUpperCase(), value: ME.name }],
      secondaryFields: [{ key: 'company', label: 'COMPANY', value: ME.company }],
      auxiliaryFields: [
        { key: 'phone', label: 'PHONE', value: ME.phone },
        { key: 'email', label: 'EMAIL', value: ME.email, textAlignment: 'PKTextAlignmentRight' }
      ],
      backFields: [
        { key: 'b-phone', label: 'Phone', value: ME.phone, attributedValue: `<a href="tel:${tel}">${ME.phone}</a>` },
        { key: 'b-email', label: 'Email', value: ME.email, attributedValue: `<a href="mailto:${ME.email}">${ME.email}</a>` },
        { key: 'b-web', label: 'Website', value: ME.web, attributedValue: `<a href="${ME.web}">${ME.web.replace('https://', '')}</a>` },
        { key: 'b-ig', label: 'Instagram', value: ME.instagram },
        { key: 'b-where', label: 'Where', value: ME.city },
        { key: 'b-what', label: 'Timbro', value: 'Loyalty cards in Apple and Google Wallet for cafés, bakeries and shops. No app, no paper.' }
      ]
    },
    // Scanning the code saves the contact.
    barcodes: [{ format: 'PKBarcodeFormatQR', message: `${settings.publicUrl}/bizcard.vcf`, messageEncoding: 'iso-8859-1', altText: 'Scan to save my contact' }]
  };
  const files = { 'pass.json': Buffer.from(JSON.stringify(passJson)) };
  for (const n of ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png']) files[n] = file(n);
  const { signerCert, signerKey, signerKeyPassphrase, wwdr } = settings.apple;
  return new PKPass(files, { signerCert, signerKey, signerKeyPassphrase, wwdr }).getAsBuffer();
}
