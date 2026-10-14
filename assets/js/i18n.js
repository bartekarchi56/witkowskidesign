/*
 * Tiny translation helper (Italian / English / Polish).
 *
 *   <h1 data-i18n="hero.title"></h1>            → textContent
 *   <p data-i18n-html="hero.lede"></p>           → innerHTML (our own strings only)
 *   <input data-i18n-attr="placeholder:form.name">
 *
 * Pages add their own strings with I18N.add({ it: {...}, en: {...}, pl: {...} }).
 * A missing string falls back to English. A string can be a function of the
 * vars (Polish plurals: I18N.plural(n, ['pieczątka', 'pieczątki', 'pieczątek'])).
 * A page that is not translated into every language lists its own on the
 * switcher: <div class="lang" data-langs="it,en"></div>.
 * Listen for language changes with document.addEventListener('langchange', fn).
 */
(function () {
  const KEY = 'timbro:lang';
  const LANGS = ['it', 'en', 'pl'];
  const LOCALES = { it: 'it-IT', en: 'en-GB', pl: 'pl-PL' };
  const dict = { it: {}, en: {}, pl: {} };
  // Languages this page offers (the first .lang switcher's data-langs, else all).
  const pageLangs = () => { const el = document.querySelector('.lang[data-langs]'); return el ? el.dataset.langs.split(',').filter(l => LANGS.includes(l)) : LANGS; };

  function initial() {
    const q = new URLSearchParams(location.search).get('lang');
    const ok = pageLangs();
    if (ok.includes(q)) return q;
    try { const s = localStorage.getItem(KEY); if (ok.includes(s)) return s; } catch (e) {}
    const nav = (navigator.language || '').toLowerCase().slice(0, 2);
    return ok.includes(nav) ? nav : ok.includes('en') ? 'en' : ok[0];
  }

  const I18N = {
    lang: initial(),
    langs: LANGS,
    add(d) { LANGS.forEach(l => Object.assign(dict[l], d[l] || {})); return this; },
    t(key, vars) {
      let s = dict[this.lang][key] ?? dict.en[key] ?? key;
      if (typeof s === 'function') s = s(vars || {});
      if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
      return s;
    },
    // Pick the right language from an {it, en, pl} object.
    pick(o) { return o[this.lang] || o.en; },
    // For dates and numbers: it-IT, en-GB, pl-PL.
    locale(lang = this.lang) { return LOCALES[lang] || 'en-GB'; },
    // Polish noun forms: [1, 2-4 (not 12-14), 5+]  e.g. ['pieczątka', 'pieczątki', 'pieczątek'].
    plural(n, [one, few, many]) {
      const d = n % 10, h = n % 100;
      return n === 1 ? one : d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
    },
    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = this.t(el.dataset.i18nHtml); });
      root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        el.dataset.i18nAttr.split(';').forEach(pair => {
          const [attr, key] = pair.split(':');
          if (attr && key) el.setAttribute(attr.trim(), this.t(key.trim()));
        });
      });
      document.documentElement.lang = this.lang;
      document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === this.lang)));
    },
    set(lang) {
      if (!pageLangs().includes(lang)) return;
      this.lang = lang;
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      this.apply();
      document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    },
    // Render an IT / EN / PL switch into every .lang element on the page.
    switchers() {
      document.querySelectorAll('.lang').forEach(el => {
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Lingua / Language / Język');
        el.innerHTML = pageLangs().map(l => `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === this.lang}">${l.toUpperCase()}</button>`).join('');
        el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.set(b.dataset.lang); });
      });
    }
  };

  // Strings shared by every screen.
  I18N.add({
    it: {
      'pass.collect': 'Raccogli {n} timbri: {reward}',
      'pass.ready': 'Premio pronto: mostralo alla cassa',
      'pass.show': 'Mostra alla cassa',
      'pass.stamps': 'Timbri', 'pass.reward': 'Premio', 'pass.member': 'Cliente', 'pass.card': 'Carta', 'pass.tap': 'Tocca ··· per i dettagli',
      'pass.aria': '{title}: {have} timbri su {need}',
      'ago.never': 'Mai', 'ago.now': 'Adesso', 'ago.min': '{n} min fa', 'ago.h': '{n} h fa', 'ago.d': '{n} g fa',
      'copied': 'Copiato'
    },
    en: {
      'pass.collect': 'Collect {n} stamps: {reward}',
      'pass.ready': 'Reward ready: show it at the till',
      'pass.show': 'Show at the till',
      'pass.stamps': 'Stamps', 'pass.reward': 'Reward', 'pass.member': 'Member', 'pass.card': 'Card', 'pass.tap': 'Tap ··· for details',
      'pass.aria': '{title}: {have} of {need} stamps',
      'ago.never': 'Never', 'ago.now': 'Just now', 'ago.min': '{n} min ago', 'ago.h': '{n} h ago', 'ago.d': '{n} d ago',
      'copied': 'Copied'
    },
    pl: {
      'pass.collect': ({ n }) => `Zbierz ${n} ${I18N.plural(+n, ['pieczątkę', 'pieczątki', 'pieczątek'])}: {reward}`,
      'pass.ready': 'Nagroda gotowa: pokaż ją przy kasie',
      'pass.show': 'Pokaż przy kasie',
      'pass.stamps': 'Pieczątki', 'pass.reward': 'Nagroda', 'pass.member': 'Klient', 'pass.card': 'Karta', 'pass.tap': 'Dotknij ···, aby zobaczyć szczegóły',
      'pass.aria': '{title}: {have} z {need} pieczątek',
      'ago.never': 'Nigdy', 'ago.now': 'Przed chwilą', 'ago.min': '{n} min temu', 'ago.h': '{n} godz. temu', 'ago.d': '{n} dni temu',
      'copied': 'Skopiowano'
    }
  });

  window.I18N = I18N;
})();
