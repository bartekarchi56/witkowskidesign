// Instagram's API takes JPEG images only, from a public address. This makes JPEG copies
// of the PNG posts, carousel slides and reel covers in jpg/<lang>/, which the website serves.
// Run after make.js:   node marketing/instagram/make-jpg.js
const fs = require('fs'), path = require('path');
const sharp = require(path.join(__dirname, '../../wallet/node_modules/sharp'));
(async () => {
  for (const lang of ['it', 'en']) {
    const from = path.join(__dirname, lang), to = path.join(__dirname, 'jpg', lang);
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from).filter(f => f.endsWith('.png'))) {
      await sharp(path.join(from, f)).flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(to, f.replace(/\.png$/, '.jpg')));
    }
    console.log('✓', lang, fs.readdirSync(to).length, 'images');
  }
})();
