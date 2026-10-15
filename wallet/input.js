// Checks and tidies the card + customer sent by the customer's card page.
//
// PROTOTYPE NOTE: the website keeps data in the browser, so the page sends the
// card to us. Once there is a database, look the card and customer up by ID
// here instead of trusting what the browser sends.
import { readMessages } from './messages.js';

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export function readPassRequest(raw) {
  const { card = {}, customer = {}, lang } = raw || {};
  const c = {
    id: str(card.id, 40).toLowerCase(),
    business: str(card.business, 40),
    title: str(card.title, 40), titleEn: str(card.titleEn, 40),
    lang: ['it', 'en', 'pl'].includes(card.lang) ? card.lang : 'it',
    reward: str(card.reward, 60), rewardEn: str(card.rewardEn, 60),
    stampsNeeded: Math.max(1, Math.min(20, parseInt(card.stampsNeeded, 10) || 10)),
    color: str(card.color, 7), ink: str(card.ink, 7), icon: str(card.icon, 12),
    stamp: str(card.stamp, 12), style: str(card.style, 12), type: str(card.type, 16),
    logo: typeof card.logo === 'string' && card.logo.length < 800000 ? card.logo : '',
    logoAuto: typeof card.logoAuto === 'string' && card.logoAuto.length < 400000 ? card.logoAuto : '',
    stampImage: typeof card.stampImage === 'string' && card.stampImage.length < 400000 ? card.stampImage : '',
    stripImage: typeof card.stripImage === 'string' && card.stripImage.length < 900000 ? card.stripImage : '',
    markImage: typeof card.markImage === 'string' && card.markImage.length < 200000 ? card.markImage : '',
    shape: str(card.shape, 10), mark: str(card.mark, 10), markText: str(card.markText, 2),
    empty: str(card.empty, 10), strip: str(card.strip, 7), tagline: str(card.tagline, 30),
    messages: readMessages(card.messages)
  };
  const m = {
    id: str(customer.id, 6).toUpperCase(),
    name: str(customer.name, 60) || 'Guest',
    stamps: Math.max(0, parseInt(customer.stamps, 10) || 0),
    // The customer's own secret (database cards): it becomes the pass's token for live updates.
    secret: /^[a-f0-9]{48}$/.test(customer.secret || '') ? customer.secret : ''
  };
  if (!/^[a-z0-9-]{1,40}$/.test(c.id)) throw new Error('Invalid card id');
  if (!/^[A-Z0-9]{6}$/.test(m.id)) throw new Error('Invalid customer code');
  if (!c.business || !c.title) throw new Error('Missing card name');
  m.stamps = Math.min(m.stamps, c.stampsNeeded);
  return { card: c, customer: m, lang: ['it', 'en', 'pl'].includes(lang) ? lang : 'it' };
}

export const LABELS = {
  it: { stamps: 'TIMBRI', reward: 'PREMIO', member: 'CLIENTE', how: 'Come funziona', howText: n => `Mostra il codice alla cassa a ogni visita: ricevi un timbro. Dopo ${n} timbri ricevi il premio.`, by: 'Carta fedeltà con', change: 'Timbri: %@', points: 'Timbri', news: 'Novità', quiet: 'Un timbro a ogni visita.' },
  pl: { stamps: 'PIECZĄTKI', reward: 'NAGRODA', member: 'KLIENT', how: 'Jak to działa', howText: n => `Pokaż kod przy kasie przy każdej wizycie: dostaniesz pieczątkę. Po ${n} pieczątkach odbierasz nagrodę.`, by: 'Karta lojalnościowa od', change: 'Pieczątki: %@', points: 'Pieczątki', news: 'Nowości', quiet: 'Pieczątka przy każdej wizycie.' },
  en: { stamps: 'STAMPS', reward: 'REWARD', member: 'MEMBER', how: 'How it works', howText: n => `Show the code at the till every visit to get a stamp. After ${n} stamps you get the reward.`, by: 'Loyalty card by', change: 'Stamps: %@', points: 'Stamps', news: 'News', quiet: 'One stamp every visit.' }
};
