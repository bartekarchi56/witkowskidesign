/*
 * Data layer for the loyalty service.
 *
 * Two modes:
 *  • Demo (default): everything lives in this browser (localStorage).
 *  • Connected: the dashboard and Studio call Store.attachRemote() with data
 *    from Supabase (remote.js). Reads come from that copy; every change is
 *    also sent to the database. Errors fire a 'storeerror' event.
 * The customer card and the stamper talk to Remote directly.
 */
(function () {
  const KEY = 'timbro:v1';
  let memory = null;   // fallback when localStorage is blocked
  let remoteDb = null; // connected mode: the data loaded from Supabase

  function load() {
    if (remoteDb) return remoteDb;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw);
        // Browsers that saw the older example get The Coffee's new look.
        const tc = db.cards['the-coffee'];
        if (tc && (tc.stampImage !== COFFEE_DOT || !tc.hideCount)) { Object.assign(tc, COFFEE_LOOK); save(db); }
        // Browsers from before the Orsonero proposal get its example card too.
        if (!db.cards.orsonero || db.cards.orsonero.stampImage !== ORSONERO_BEAR) { db.cards.orsonero = { ...db.cards.orsonero, ...ORSONERO }; save(db); }
        if (!db.cards.sowa || db.cards.sowa.stampImage !== SOWA.stampImage) { db.cards.sowa = { createdAt: Date.now(), ...db.cards.sowa, ...SOWA }; save(db); }
        if (!db.cards.sisu || db.cards.sisu.stripImage !== SISU.stripImage) { db.cards.sisu = { createdAt: Date.now(), ...db.cards.sisu, ...SISU }; save(db); }
        if (!db.cards.parzymy || db.cards.parzymy.stripImage !== PARZYMY.stripImage) { db.cards.parzymy = { createdAt: Date.now(), ...db.cards.parzymy, ...PARZYMY }; save(db); }
        if (!db.cards.younique || db.cards.younique.stripImage !== YOUNIQUE.stripImage) { db.cards.younique = { createdAt: Date.now(), ...db.cards.younique, ...YOUNIQUE }; save(db); }
        if (!db.cards.cafezal || db.cards.cafezal.stripImage !== CAFEZAL.stripImage) { db.cards.cafezal = { createdAt: Date.now(), ...db.cards.cafezal, ...CAFEZAL }; save(db); }
        return db;
      }
    } catch (e) { if (memory) return memory; }
    return memory || seed();
  }

  function save(db) {
    if (remoteDb) { remoteDb = db; return; }
    memory = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memory only */ }
  }

  // The Coffee, Viale Piave 20: Japanese minimalism and the name in katakana. Kept very
  // simple: a white card with flat black dots; empty boxes show the same dot, faint grey.
  // (stamp 'punto' is what the Wallet server draws, since demo cards send no artwork.)
  const COFFEE_DOT = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#0B0B0C"/></svg>');
  const COFFEE_LOOK = { plan: 'plus', style: 'minimal', color: '#FFFFFF', ink: '#0B0B0C', stamp: 'punto',
    font: 'wide', strip: '', tagline: 'ザ・コーヒー', stampImage: COFFEE_DOT, hideCount: true };

  // Orsonero Coffee, Via Broggi 15 (proposal): the black bear of the name
  // (Brent's Canada), light oak and white walls, Nordic-Japanese calm.
  // The bear stamp is our own drawing, not Orsonero's logo.
  const ORSONERO_BEAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48ZyBmaWxsPSIjMUExQTFBIj48Y2lyY2xlIGN4PSIyNCIgY3k9IjI3IiByPSIxNCIvPjxjaXJjbGUgY3g9Ijc2IiBjeT0iMjciIHI9IjE0Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iNTYiIHJ4PSIzNyIgcnk9IjMzIi8+PC9nPjxnIGZpbGw9IiNFQURGQ0IiPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjciIHI9IjUuNSIvPjxjaXJjbGUgY3g9Ijc2IiBjeT0iMjciIHI9IjUuNSIvPjxlbGxpcHNlIGN4PSI1MCIgY3k9IjY5IiByeD0iMTUiIHJ5PSIxMSIvPjwvZz48ZWxsaXBzZSBjeD0iNTAiIGN5PSI2NCIgcng9IjUuNSIgcnk9IjMuOCIgZmlsbD0iIzFBMUExQSIvPjwvc3ZnPg==';
  const ORSONERO = {
    id: 'orsonero', business: 'Orsonero Coffee', city: 'Milano', type: 'caffe',
    title: 'Carta Orsonero', reward: 'un caffè a scelta', titleEn: 'Orsonero card', rewardEn: 'any coffee, on us',
    stampsNeeded: 8, icon: 'cup', plan: 'plus', style: 'minimal',
    color: '#FFFFFF', ink: '#1A1A1A', shape: 'dot', mark: 'none', empty: 'outline', font: 'sans',
    strip: '#EADFCB', tagline: 'Specialty coffee', stampImage: ORSONERO_BEAR
  };

  // Cukiernia Sowa, Bydgoszcz (proposal): their 80th-anniversary coffee card, with
  // their "80" logo, their feather pattern and their owl as the stamp. The artwork
  // lives in assets/demo/sowa/ (the card page turns it into data for Wallet).
  const SOWA = {
    id: 'sowa', business: 'Cukiernia Sowa', city: 'Bydgoszcz', type: 'pasticceria', lang: 'pl',
    title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee',
    stampsNeeded: 8, icon: 'cup', plan: 'chain', style: 'bottega',
    color: '#FBF6EE', ink: '#522D24', font: 'serif', strip: '#FBF6EE', tagline: '80 lat tradycji',
    logo: '/assets/demo/sowa/logo-80.svg', stampImage: '/assets/demo/sowa/owl-stamp.png', stripImage: '/assets/demo/sowa/strip.png'
  };

  // SISU., Milano (proposal): their serif SISU. in sage on cream, liquid sage stripes behind
  // cream stamps (print/sisu-look.js draws it; the PNGs are in assets/demo/sisu/).
  const SISU = {
    id: 'sisu', business: 'SISU.', city: 'Milano', type: 'caffe', lang: 'it',
    title: 'Carta Sisu', reward: 'un caffè gratis', titleEn: 'Sisu card', rewardEn: 'a free coffee',
    stampsNeeded: 10, icon: 'cup', plan: 'plus', style: 'minimal',
    color: '#EEE5D8', ink: '#6B7262', font: 'sans', strip: '#EEE5D8',
    logo: '/assets/demo/sisu/logo.png', iconLogo: '/assets/demo/sisu/mark.png', stampImage: '/assets/demo/sisu/stamp.png', stripImage: '/assets/demo/sisu/strip.png'
  };

  // Parzymy Tutaj, Bydgoszcz (proposal): their light green and their mark as the stamp
  // (print/parzymy-look.js draws it; the PNGs are in assets/demo/parzymy/).
  const PARZYMY = {
    id: 'parzymy', business: 'Parzymy Tutaj', city: 'Bydgoszcz', type: 'caffe', lang: 'pl',
    title: 'Karta kawowa', reward: 'kawa gratis', titleEn: 'Coffee card', rewardEn: 'a free coffee',
    stampsNeeded: 10, icon: 'cup', plan: 'plus', style: 'minimal',
    color: '#C9E3A3', ink: '#2F4A2B', font: 'sans', strip: '#C9E3A3',
    logo: '/assets/demo/parzymy/logo.png', iconLogo: '/assets/demo/parzymy/mark.png', stampImage: '/assets/demo/parzymy/stamp.png', stripImage: '/assets/demo/parzymy/strip.png'
  };

  // Younique Café Golden Goose, Milano (proposal): black and gold, vinyl records as stamps
  // (print/younique-look.js draws it; the PNGs are in assets/demo/younique/).
  const YOUNIQUE = {
    id: 'younique', business: 'Younique Café', city: 'Milano', type: 'caffe', lang: 'it', tagline: 'GOLDEN GOOSE',
    title: 'Carta Younique', reward: 'un caffè gratis', titleEn: 'Younique card', rewardEn: 'a free coffee',
    stampsNeeded: 10, icon: 'cup', plan: 'plus', style: 'minimal',
    color: '#141312', ink: '#C9A24A', font: 'wide', strip: '#141312',
    stampImage: '/assets/demo/younique/stamp.png', stripImage: '/assets/demo/younique/strip.png'
  };

  // Cafezal, Piazza Gae Aulenti (proposal): night blue and cream, their palms faint behind the stamps,
  // their wordmark and their double palm as the stamp. Same card as print/cafezal-look.js (navy).
  const CAFEZAL = {
    id: 'cafezal', business: 'Cafezal', city: 'Milano', type: 'caffe', lang: 'it', tagline: 'Piazza Gae Aulenti · Milano',
    title: 'Carta Cafezal', reward: 'un caffè gratis', titleEn: 'Cafezal card', rewardEn: 'a free coffee',
    stampsNeeded: 10, icon: 'cup', plan: 'plus', style: 'minimal', color: '#1C2638', ink: '#F3EDE2', font: 'serif', strip: '#16202F',
    logo: '/assets/demo/cafezal/word-cream.png', iconLogo: '/assets/demo/cafezal/stamp-cream.png',
    stampImage: '/assets/demo/cafezal/stamp-cream.png', stripImage: '/assets/demo/cafezal/strip-palms-navy.png'
  };

  // Every fresh browser starts with the example card for The Coffee, so a
  // QR code on the brochure opens a working card on any phone.
  function seed() {
    const db = { cards: {}, customers: {} };
    db.cards['the-coffee'] = {
      id: 'the-coffee',
      business: 'The Coffee',
      city: 'Milano',
      type: 'caffe',
      title: 'Carta caffè',
      reward: 'un caffè gratis',
      titleEn: 'Coffee card',
      rewardEn: 'a free coffee',
      stampsNeeded: 10,
      icon: 'cup',
      ...COFFEE_LOOK,
      createdAt: Date.now()
    };
    db.cards.orsonero = { ...ORSONERO, createdAt: Date.now() };
    db.cards.sowa = { ...SOWA, createdAt: Date.now() };
    db.cards.sisu = { ...SISU, createdAt: Date.now() };
    db.cards.parzymy = { ...PARZYMY, createdAt: Date.now() };
    db.cards.younique = { ...YOUNIQUE, createdAt: Date.now() };
    db.cards.cafezal = { ...CAFEZAL, createdAt: Date.now() };
    save(db);
    return db;
  }

  // Everything about how a card looks (as opposed to its text and rules).
  const DESIGN_KEYS = ['style', 'color', 'ink', 'stamp', 'shape', 'mark', 'markText', 'empty', 'font', 'strip', 'tagline', 'icon', 'logo', 'stampImage', 'stripImage', 'hideFields'];

  // Short, unambiguous codes staff can read out or type (no 0/O, 1/I).
  function code(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    const buf = new Uint32Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
    return s;
  }

  // Connected mode: send a change to the database in the background.
  function sync(call) {
    if (!remoteDb) return;
    call().then(r => {
      if (r && r.id && remoteDb.cards[r.id]) Object.assign(remoteDb.cards[r.id], r);
    }).catch(err => document.dispatchEvent(new CustomEvent('storeerror', { detail: err.message })));
  }
  const byId = list => Object.fromEntries((list || []).map(x => [x.id, x]));

  // What the database works out for a customer's extras (schema.sql _customer_json), worked out
  // here for the demo: birthday gift due (their birthday week, no gift since), when a friend's
  // bonus and the last reward came, and how many friends joined with their invite.
  function withExtras(c, db) {
    if (!c) return c;
    const last = type => (c.history || []).filter(h => h.type === type).reduce((a, h) => Math.max(a, h.t), 0) || null;
    let birthday = false;
    if (c.birthDate) {
      const b = new Date(c.birthDate + 'T00:00:00'), now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let bd = new Date(today.getFullYear(), b.getMonth(), b.getDate());
      if (bd > today) bd = new Date(today.getFullYear() - 1, b.getMonth(), b.getDate());
      birthday = (today - bd) / 864e5 <= 6.5 && !(c.giftAt && c.giftAt >= bd.getTime());
    }
    const friends = Object.values(db.customers).filter(f => f.referredBy === c.id && f.refPaid).length;
    return Object.assign(c, { birthday, lastFriend: last('friend'), lastRedeem: last('redeem'), friends });
  }

  const Store = {
    get remote() { return Boolean(remoteDb); },
    attachRemote(data) { remoteDb = { cards: byId(data.cards), customers: byId(data.customers) }; },
    // New data from the database (e.g. a timed refresh): screens redraw.
    refresh(data) { if (!remoteDb) return; this.attachRemote(data); document.dispatchEvent(new CustomEvent('storechange')); },

    // ---- cards (what the business designs) ----
    listCards() { return Object.values(load().cards).sort((a, b) => a.createdAt - b.createdAt); },
    getCard(id) { return load().cards[id] || null; },
    saveCard(card) {
      const db = load();
      if (!card.id) { card.id = code(6).toLowerCase(); card.createdAt = Date.now(); }
      card.updatedAt = Date.now();
      const isNew = !db.cards[card.id];
      db.cards[card.id] = { ...db.cards[card.id], ...card };
      save(db);
      const saved = db.cards[card.id];
      sync(() => Remote.saveCard({ ...saved, design: isNew ? this.designOf(saved) : undefined }));
      return saved;
    },

    // Notification texts (dashboard → Notifications). Saved straight away, like texts.
    saveMessages(cardId, messages) {
      const db = load(), card = db.cards[cardId];
      if (!card) return null;
      card.messages = messages; card.updatedAt = Date.now();
      save(db);
      sync(() => Remote.saveMessages(cardId, messages));
      return card;
    },

    // A message to all the card's customers (dashboard → Notifications), at most one a day.
    // Connected: the database checks and sends it (Remote.sendNews). Throws 'daily' when too soon.
    async sendNews(cardId, text) {
      const db = load(), card = db.cards[cardId];
      if (!card) return null;
      text = String(text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140);
      if (!text) throw new Error('empty');
      if (remoteDb) {
        let r;
        try { r = await Remote.sendNews(cardId, text); } catch (e) { throw new Error(/a day/i.test(e.message) ? 'daily' : e.message); }
        Object.assign(card, r);
        return card;
      }
      if (card.newsAt && Date.now() - card.newsAt < 20 * 3600000) throw new Error('daily');
      Object.assign(card, { news: text, newsAt: Date.now(), updatedAt: Date.now() });
      save(db);
      return card;
    },

    // ---- customers (one per person per card) ----
    // who: { name, email, phone, birthDate, marketing } (or just a name)
    join(cardId, who) {
      const db = load();
      if (!db.cards[cardId]) throw new Error('This card no longer exists.');
      if (typeof who === 'string') who = { name: who };
      let id;
      do { id = code(6); } while (db.customers[id]);
      // Bring a friend: who invited them (a customer of the same card).
      const inviter = who.ref && db.customers[String(who.ref).trim().toUpperCase()];
      db.customers[id] = {
        referredBy: inviter && inviter.cardId === cardId ? inviter.id : null, refPaid: false,
        id, cardId, name: (who.name || '').trim() || 'Guest',
        email: who.email || '', phone: who.phone || '', birthDate: who.birthDate || null, marketing: !!who.marketing,
        stamps: 0, redeemed: 0, joinedAt: Date.now(), lastVisit: null,
        history: [{ t: Date.now(), type: 'joined' }]
      };
      save(db);
      return db.customers[id];
    },
    getCustomer(id) { const db = load(); return withExtras(db.customers[(id || '').trim().toUpperCase()] || null, db); },
    listCustomers(cardId) {
      return Object.values(load().customers)
        .filter(c => !cardId || c.cardId === cardId)
        .sort((a, b) => (b.lastVisit || b.joinedAt) - (a.lastVisit || a.joinedAt));
    },

    // Add a stamp for a visit (delta > 0) or remove one. Never goes past the goal. Like the
    // database's stamper_stamp, extras add more as a 'bonus': one in the double-stamp hours, and
    // on a friend's first stamp one more for them and one ('friend') for whoever invited them.
    // Returns { customer, extra: { double, friend: the inviter's code } }.
    stamp(customerId, delta = 1) {
      const db = load();
      const c = db.customers[customerId];
      if (!c) throw new Error('No customer with that code.');
      const card = db.cards[c.cardId], now = Date.now(), extra = { double: false, friend: null };
      let more = 0;
      if (delta > 0 && c.stamps < card.stampsNeeded && window.UI) {
        const m = UI.messagesOf(card);
        if (UI.doubleNow(card)) { extra.double = true; more++; }
        if (c.referredBy && !c.refPaid && m.friend.on && !c.history.some(h => h.type === 'stamp')) {
          more++; c.refPaid = true;
          const inv = db.customers[c.referredBy];
          if (inv && inv.cardId === c.cardId && inv.stamps < card.stampsNeeded) { inv.stamps++; inv.history.push({ t: now, type: 'friend', n: 1 }); extra.friend = inv.id; }
        }
      }
      const next = Math.max(0, Math.min(card.stampsNeeded, c.stamps + (delta > 0 ? 1 + more : -1)));
      if (next !== c.stamps) {
        c.history.push({ t: now, type: delta > 0 ? 'stamp' : 'unstamp', n: 1 });
        if (next - c.stamps > 1) c.history.push({ t: now, type: 'bonus', n: next - c.stamps - 1 });
        c.stamps = next;
        c.lastVisit = now;
      }
      save(db);
      return { customer: withExtras(c, db), extra };
    },

    // The birthday gift (birthday switched on, in the customer's birthday week, once a year).
    gift(customerId) {
      const db = load(), c = withExtras(db.customers[customerId], db);
      const card = c && db.cards[c.cardId];
      if (!c || !window.UI || !UI.messagesOf(card).birthday.on || !c.birthday) throw new Error('No birthday gift due for this customer.');
      c.giftAt = c.lastVisit = Date.now();
      c.history.push({ t: c.giftAt, type: 'gift' });
      save(db);
      return withExtras(c, db);
    },

    // Hand over the reward: card starts again from zero.
    redeem(customerId) {
      const db = load();
      const c = db.customers[customerId];
      const card = c && db.cards[c.cardId];
      if (!c || c.stamps < card.stampsNeeded) throw new Error('This card is not full yet.');
      c.stamps = 0;
      c.redeemed += 1;
      c.lastVisit = Date.now();
      c.history.push({ t: Date.now(), type: 'redeem' });
      save(db);
      return c;
    },

    // Plus/Pro: the café asks Witkowski Design for a change in words.
    requestDesign(cardId, note, extras = {}) {
      const db = load(); const card = db.cards[cardId];
      card.review = { status: 'pending', kind: 'request', design: {}, note: (note || '').trim(), images: extras.images || [], links: extras.links || [], sentAt: Date.now(), reply: '' };
      save(db);
      sync(() => Remote.sendDesign(cardId, 'request', {}, card.review.note, card.review.images, card.review.links));
      return card;
    },

    // ---- design review ----
    // Café owners propose design changes; Witkowski Design approves them in
    // the Studio. Customers keep seeing the live design until then.
    DESIGN_KEYS,
    designOf(card) { const d = {}; DESIGN_KEYS.forEach(k => { if (card[k] !== undefined) d[k] = card[k]; }); return d; },
    // extras: { images: [data URLs], links: [urls] } – photos and inspiration for the designer.
    proposeDesign(cardId, design, note, extras = {}) {
      const db = load(); const card = db.cards[cardId];
      if (!card) throw new Error('No card');
      card.review = { status: 'pending', kind: 'proposal', design, note: (note || '').trim(), images: extras.images || [], links: extras.links || [], sentAt: Date.now(), reply: '' };
      save(db);
      sync(() => Remote.sendDesign(cardId, 'proposal', design, card.review.note, card.review.images, card.review.links));
      return card;
    },
    approveDesign(cardId, design) {
      const db = load(); const card = db.cards[cardId];
      const d = design || (card.review && card.review.design) || {};
      DESIGN_KEYS.forEach(k => { if (d[k] !== undefined) card[k] = d[k]; });
      card.review = { status: 'approved', at: Date.now(), reply: '' };
      card.updatedAt = Date.now();
      save(db);
      sync(() => Remote.publish(cardId, d));
      return card;
    },
    askChanges(cardId, reply) {
      const db = load(); const card = db.cards[cardId];
      card.review = { ...(card.review || {}), status: 'changes', reply: (reply || '').trim(), at: Date.now() };
      save(db);
      sync(() => Remote.askChanges(cardId, card.review.reply));
      return card;
    },
    // The plan comes from the subscription; in connected mode only the designer can set it.
    setPlan(cardId, plan) {
      const db = load(); db.cards[cardId].plan = plan; save(db);
      sync(() => Remote.setPlan(cardId, plan));
      return db.cards[cardId];
    },
    listPending() { return Object.values(load().cards).filter(c => c.review && c.review.status === 'pending').sort((a, b) => a.review.sentAt - b.review.sentAt); },

    stats(cardId) {
      const list = this.listCustomers(cardId);
      const weekAgo = Date.now() - 7 * 864e5;
      let stamps = 0, redeemed = 0, active = 0;
      list.forEach(c => {
        c.history.forEach(h => { if (h.type === 'stamp') stamps += h.n; if (h.type === 'unstamp') stamps -= h.n; });
        redeemed += c.redeemed;
        if ((c.lastVisit || 0) > weekAgo) active++;
      });
      return { members: list.length, stamps, redeemed, active };
    },

    // Re-render when another tab (e.g. the stamper) changes data.
    onChange(fn) {
      window.addEventListener('storage', e => { if (e.key === KEY && !remoteDb) fn(); });
      document.addEventListener('storechange', fn);
    },

    reset() { try { localStorage.removeItem(KEY); } catch (e) {} memory = null; }
  };

  window.Store = Store;
})();
