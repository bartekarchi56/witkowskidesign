// Who can do what. Run against a fresh database loaded with
// supabase-stub.sql + ../schema.sql (see supabase/README.md).
import assert from 'node:assert/strict';
import { pool, call, raw } from './db.js';

const anon = { role: 'anon' };
const users = {};
for (const name of ['ownerA', 'ownerB', 'designer']) {
  const r = await pool.query(`insert into auth.users (email) values ($1) on conflict (email) do update set email = excluded.email returning id`, [name + '@test.local']);
  users[name] = { role: 'authenticated', sub: r.rows[0].id };
}
await pool.query('insert into timbro.admins (user_id) values ($1) on conflict do nothing', [users.designer.sub]);
const rejects = async (p, re, msg) => { await assert.rejects(p, re, msg); };
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const id = 'test-' + Date.now().toString(36);

// ---- tables are closed to everyone ----
await rejects(raw(anon, 'select * from timbro.cards'), /permission denied/, 'anon reads cards');
await rejects(raw(users.ownerA, 'select * from timbro.customers'), /permission denied/, 'owner reads customers table');
ok('nobody can read the tables directly');

// ---- owner A creates a card ----
await rejects(call(anon, 'owner_save_card', { p_card: { id } }), /permission denied/);
const card = await call(users.ownerA, 'owner_save_card', { p_card: { id, business: 'Bar Test', title: 'Carta caffè', reward: 'un caffè gratis', stampsNeeded: 3, design: { color: '#FFFFFF', ink: '#2B32FF', stamp: 'onda', evil: 'x' } } });
assert.equal(card.business, 'Bar Test'); assert.equal(card.plan, 'start'); assert.equal(card.evil, undefined); assert.equal(card.stamp, 'onda');
ok('owner creates a card; its stamp is kept, unknown design keys are dropped; plan starts as Start');
await rejects(call(users.ownerB, 'owner_save_card', { p_card: { id, business: 'Hijack' } }), /another café/);
ok('another owner cannot overwrite it');

// ---- a customer joins ----
assert.equal((await call(anon, 'get_card', { p_card_id: id })).title, 'Carta caffè');
const who = { p_card_id: id, p_name: 'Giulia  Rossi', p_email: 'Giulia@Example.com', p_phone: '+39 333 123 4567', p_birth: '1995-04-12', p_marketing: true };
await rejects(call(anon, 'join_card', { ...who, p_name: 'Giulia' }), /full name/);
await rejects(call(anon, 'join_card', { ...who, p_email: 'giulia@' }), /email/);
await rejects(call(anon, 'join_card', { ...who, p_phone: '123' }), /mobile/);
await rejects(call(anon, 'join_card', { ...who, p_birth: null }), /date of birth/);
await rejects(call(anon, 'join_card', { ...who, p_birth: new Date(Date.now() - 10 * 365 * 864e5).toISOString().slice(0, 10) }), /date of birth/);
const joined = await call(anon, 'join_card', who);
assert.match(joined.id, /^[A-Z0-9]{6}$/); assert.equal(joined.secret.length, 48);
const mine = await call(anon, 'get_my_card', { p_code: joined.id, p_secret: joined.secret });
assert.equal(mine.customer.name, 'Giulia Rossi'); assert.equal(mine.customer.stamps, 0); assert.equal(mine.customer.email, undefined);
assert.equal(await call(anon, 'get_my_card', { p_code: joined.id, p_secret: 'wrong' }), null);
ok('customer joins with full name, email, mobile and date of birth, and reads their card only with their secret');

// ---- linking the cashier's phone ----
await rejects(call(users.ownerB, 'owner_link_code'), /Create your card first/);
const link = await call(users.ownerA, 'owner_link_code');
assert.match(link.code, /^[A-Z0-9]{8}$/);
const dev = await call(anon, 'device_link', { p_code: link.code.toLowerCase(), p_name: 'Cassa 1' });
assert.equal(dev.business, 'Bar Test');
await rejects(call(anon, 'device_link', { p_code: link.code, p_name: 'Again' }), /expired or was already used/);
ok('link code works once, for the right café');

// ---- stamping ----
await rejects(call(anon, 'stamper_lookup', { p_token: 'nope', p_code: joined.id }), /not linked/);
assert.equal((await call(anon, 'stamper_lookup', { p_token: dev.token, p_code: joined.id.toLowerCase() })).customer.name, 'Giulia Rossi');
await rejects(call(anon, 'stamper_redeem', { p_token: dev.token, p_code: joined.id }), /not full yet/);
for (let i = 0; i < 5; i++) await call(anon, 'stamper_stamp', { p_token: dev.token, p_code: joined.id, p_delta: 1 });
let s = await call(anon, 'stamper_lookup', { p_token: dev.token, p_code: joined.id });
assert.equal(s.customer.email, undefined); assert.equal(s.customer.phone, undefined);   // the till never sees contact details
assert.equal(s.customer.stamps, 3, 'never goes past the goal');
await call(anon, 'stamper_stamp', { p_token: dev.token, p_code: joined.id, p_delta: -1 });
await call(anon, 'stamper_stamp', { p_token: dev.token, p_code: joined.id, p_delta: 1 });
s = await call(anon, 'stamper_redeem', { p_token: dev.token, p_code: joined.id });
assert.equal(s.customer.stamps, 0); assert.equal(s.customer.redeemed, 1);
ok('cashier stamps (capped at the goal), removes a stamp and gives the reward');

// ---- a phone from another café sees nothing ----
const cardB = 'testb-' + Date.now().toString(36);
await call(users.ownerB, 'owner_save_card', { p_card: { id: cardB, business: 'Other', title: 'X', reward: 'Y', stampsNeeded: 5 } });
const devB = await call(anon, 'device_link', { p_code: (await call(users.ownerB, 'owner_link_code')).code, p_name: 'B' });
assert.equal(await call(anon, 'stamper_lookup', { p_token: devB.token, p_code: joined.id }), null);
await rejects(call(anon, 'stamper_stamp', { p_token: devB.token, p_code: joined.id, p_delta: 1 }), /No customer/);
ok('another café\'s phone cannot see or stamp this customer');

// ---- live Wallet updates: phones register with the pass's token; only the café's till gets push tokens ----
const wr = (secret, device = 'phone-1') => call(anon, 'wallet_register', { p_code: joined.id, p_secret: secret, p_device: device, p_push: 'push-abc' });
assert.equal(await wr('wrong'), 401);
assert.equal(await wr(joined.secret), 201);
assert.equal(await wr(joined.secret), 200);
const upd = await call(anon, 'wallet_updated', { p_device: 'phone-1', p_since: 0 });
assert.deepEqual(upd.serialNumbers, [id + '-' + joined.id]); assert.ok(+upd.lastUpdated > 0);
assert.deepEqual((await call(anon, 'wallet_updated', { p_device: 'phone-1', p_since: +upd.lastUpdated })).serialNumbers, []);
assert.deepEqual(await call(anon, 'wallet_targets', { p_token: dev.token, p_code: joined.id }), ['push-abc']);
assert.deepEqual(await call(anon, 'wallet_targets', { p_token: devB.token, p_code: joined.id }), []);
await rejects(call(anon, 'wallet_targets', { p_token: 'nope', p_code: joined.id }), /not linked/);
assert.equal(await call(anon, 'wallet_unregister', { p_code: joined.id, p_secret: joined.secret, p_device: 'phone-1' }), 200);
assert.deepEqual(await call(anon, 'wallet_targets', { p_token: dev.token, p_code: joined.id }), []);
ok('Wallet phones register with the pass token; only the café\'s own till can wake them');

// ---- daily reminders: only with the job key ----
await rejects(call(anon, 'reminders_due', { p_key: '' }), /Wrong key/);
await rejects(call(anon, 'reminders_due', { p_key: 'guess' }), /Wrong key/);
await rejects(raw(anon, 'select key from timbro.job_keys'), /permission denied/);
ok('the daily reminder list needs the job key, which visitors cannot read');

// ---- owner dashboard data ----
const dataA = await call(users.ownerA, 'owner_data');
assert.equal(dataA.cards.length, 1); assert.equal(dataA.customers.length, 1); assert.equal(dataA.devices.length, 1); assert.equal(dataA.isAdmin, false);
assert.equal(dataA.customers[0].history.filter(h => h.type === 'stamp').length, 4);
const dataB = await call(users.ownerB, 'owner_data');
assert.ok(!dataB.cards.some(c => c.id === id) && !dataB.customers.some(c => c.id === joined.id));
ok('each owner sees only their own cards, customers and phones');

// ---- locations (chains): only the café's own phones ----
await call(users.ownerB, 'owner_set_device_location', { p_device_id: dataA.devices[0].id, p_location: 'Hacked' });
await call(users.ownerA, 'owner_set_device_location', { p_device_id: dataA.devices[0].id, p_location: '  Gdańsk, Długa 12 ' });
const located = await call(users.ownerA, 'owner_data');
assert.equal(located.devices[0].location, 'Gdańsk, Długa 12');
assert.ok(located.customers[0].history.filter(h => h.type === 'stamp').every(h => h.at === 'Gdańsk, Długa 12'));
ok('an owner names where their own till phones are; visits then carry that location');

// ---- design approval ----
const sent = await call(users.ownerA, 'owner_send_design', { p_card_id: id, p_kind: 'proposal', p_design: { color: '#0B0B0C' }, p_note: 'nera', p_images: ['data:image/jpeg;base64,AA=='], p_links: ['https://example.com'] });
assert.equal(sent.review.status, 'pending'); assert.equal(sent.color, '#FFFFFF', 'live design unchanged');
assert.equal((await call(anon, 'get_card', { p_card_id: id })).color, '#FFFFFF');
await rejects(call(users.ownerB, 'owner_send_design', { p_card_id: id, p_kind: 'proposal', p_design: {}, p_note: '', p_images: [], p_links: [] }), /not found/);
await rejects(call(users.ownerA, 'admin_publish', { p_card_id: id, p_design: { color: '#0B0B0C' } }), /Only Witkowski Design/);
await rejects(call(users.ownerA, 'admin_set_plan', { p_card_id: id, p_plan: 'pro' }), /Only Witkowski Design/);
ok('owner proposes; customers keep the live design; owners cannot publish or change plan');
const all = await call(users.designer, 'admin_cards');
assert.ok(all.find(c => c.id === id).review.images.length === 1);
await call(users.designer, 'admin_publish', { p_card_id: id, p_design: { color: '#0B0B0C' } });
assert.equal((await call(anon, 'get_card', { p_card_id: id })).color, '#0B0B0C');
await call(users.designer, 'admin_set_plan', { p_card_id: id, p_plan: 'plus' });
const req = await call(users.ownerA, 'owner_send_design', { p_card_id: id, p_kind: 'request', p_design: { color: '#FF0000' }, p_note: 'più verde', p_images: [], p_links: [] });
assert.deepEqual(req.review.design, {}, 'a request carries no design');
await call(users.designer, 'admin_ask_changes', { p_card_id: id, p_reply: 'manda il logo' });
assert.equal((await call(users.ownerA, 'owner_data')).cards[0].review.reply, 'manda il logo');
ok('designer sees images, publishes, sets the plan and replies');

// ---- removing a phone ----
await call(users.ownerA, 'owner_remove_device', { p_device_id: dataA.devices[0].id });
await rejects(call(anon, 'stamper_lookup', { p_token: dev.token, p_code: joined.id }), /not linked/);
ok('a removed phone stops working at once');

// ---- billing: only the Stripe functions (service role) can touch it ----
const service = { role: 'service_role' };
const syncArgs = { p_customer: 'cus_test_' + id, p_subscription: 'sub_test', p_status: 'active', p_plan: 'pro', p_interval: 'month', p_period_end: 1893456000 };
for (const who of [anon, users.ownerA, users.designer]) {
  await rejects(call(who, 'stripe_sync', syncArgs), /permission denied/);
  await rejects(call(who, 'stripe_set_customer', { p_business: dataA.cards[0] ? '00000000-0000-0000-0000-000000000000' : null, p_customer: 'cus_x' }), /permission denied/);
  await rejects(call(who, 'stripe_business', { p_user: users.ownerA.sub }), /permission denied/);
}
const bizA = await call(service, 'stripe_business', { p_user: users.ownerA.sub });
assert.equal(bizA.email, 'ownerA@test.local'); assert.equal(bizA.customer, null);
await call(service, 'stripe_set_customer', { p_business: bizA.id, p_customer: syncArgs.p_customer });
await call(service, 'stripe_set_customer', { p_business: bizA.id, p_customer: 'cus_other' });   // never replaces an existing customer
assert.equal((await call(service, 'stripe_business', { p_user: users.ownerA.sub })).customer, syncArgs.p_customer);
assert.equal(await call(service, 'stripe_is_admin', { p_user: users.designer.sub }), true);
assert.equal(await call(service, 'stripe_is_admin', { p_user: users.ownerA.sub }), false);
assert.equal(await call(service, 'stripe_sync', syncArgs), bizA.id);
const billed = await call(users.ownerA, 'owner_data');
assert.equal(billed.billing.status, 'active'); assert.equal(billed.billing.plan, 'pro'); assert.equal(billed.billing.trialUsed, true);
assert.ok(billed.cards.every(c => c.plan === 'pro'));
await call(service, 'stripe_sync', { ...syncArgs, p_status: 'canceled' });
assert.equal((await call(users.ownerA, 'owner_data')).cards[0].plan, 'pro');   // cancelling keeps the cards; you decide
assert.equal((await call(users.designer, 'admin_cards')).find(c => c.id === id).billing.status, 'canceled');
ok('only the Stripe functions change billing; a paid plan reaches the cards; you see the status in the Studio');

// ---- notification messages: owners save their own, cleaned ----
const msgs = { close: { on: true, left: 9, it: 'Ancora {left}!', en: 'x'.repeat(500) }, remind: { on: true, days: 2 }, near: { on: true, lat: '45.47', lng: '9.2' }, evil: { on: true } };
await rejects(call(anon, 'owner_save_messages', { p_card_id: id, p_messages: msgs }), /permission denied/);
await rejects(call(users.ownerB, 'owner_save_messages', { p_card_id: id, p_messages: msgs }), /another café/);
const withMsgs = await call(users.ownerA, 'owner_save_messages', { p_card_id: id, p_messages: msgs });
assert.equal(withMsgs.messages.close.left, 3); assert.equal(withMsgs.messages.close.en.length, 140);
assert.equal(withMsgs.messages.remind.days, 7); assert.equal(withMsgs.messages.near.lat, 45.47); assert.equal(withMsgs.messages.evil, undefined);
assert.equal((await call(anon, 'get_card', { p_card_id: id })).messages.close.it, 'Ancora {left}!');
ok('owners save their own notification texts; limits and unknown keys are cleaned');

// ---- customer details: only the café sees them; offers need consent and age 16+ ----
const teen = await call(anon, 'join_card', { ...who, p_name: 'Ola Nowak', p_birth: new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10) });
const seen = (await call(users.ownerA, 'owner_data')).customers;
const g = seen.find(c => c.id === joined.id), t = seen.find(c => c.id === teen.id);
assert.equal(g.email, 'giulia@example.com'); assert.equal(g.phone, '+393331234567'); assert.equal(g.birthDate, '1995-04-12'); assert.equal(g.marketing, true);
assert.equal(t.marketing, false, 'no offers to under-16s');
assert.ok(!(await call(users.ownerB, 'owner_data')).customers.some(c => c.id === joined.id));
ok('the café sees its customers\' details (never the till or other cafés); no offers consent under 16');

// ---- Polish: the card's own language and Polish messages; the Chains plan ----
assert.equal((await call(users.ownerA, 'owner_save_card', { p_card: { id, lang: 'pl' } })).lang, 'pl');
assert.equal((await call(users.ownerA, 'owner_save_card', { p_card: { id, lang: 'xx', title: 'Karta kawowa' } })).lang, 'pl');
const plMsgs = await call(users.ownerA, 'owner_save_messages', { p_card_id: id, p_messages: { ready: { on: true, pl: 'Nagroda czeka: {reward}', xx: 'no' } } });
assert.equal(plMsgs.messages.ready.pl, 'Nagroda czeka: {reward}'); assert.equal(plMsgs.messages.ready.xx, undefined);
assert.equal((await call(anon, 'get_card', { p_card_id: id })).lang, 'pl');
assert.equal((await call(users.designer, 'admin_set_plan', { p_card_id: id, p_plan: 'chain' })).plan, 'chain');
await rejects(call(users.designer, 'admin_set_plan', { p_card_id: id, p_plan: 'gold' }), /check constraint/);
ok('cards keep their language and Polish messages; the designer can set the Chains plan, not made-up ones');

// ---- a message to all customers: own cards only, once a day, on the card for everyone ----
await rejects(call(users.ownerB, 'owner_send_news', { p_card_id: id, p_text: 'Hacked' }), /another café/);
await rejects(call(users.ownerA, 'owner_send_news', { p_card_id: id, p_text: '   ' }), /Write a message/);
const news = await call(users.ownerA, 'owner_send_news', { p_card_id: id, p_text: ' Nowość: Matcha Maple Apple\n' + 'x'.repeat(200) });
assert.ok(news.news.startsWith('Nowość: Matcha Maple Apple x')); assert.equal(news.news.length, 140); assert.ok(news.newsAt > Date.now() - 60000);
assert.equal((await call(anon, 'get_card', { p_card_id: id })).news, news.news);
await rejects(call(users.ownerA, 'owner_send_news', { p_card_id: id, p_text: 'Again' }), /One message a day/);
const targets = await call(users.ownerA, 'owner_news_targets', { p_card_id: id });
assert.ok(targets.customers.some(c => c.customer.id === joined.id)); assert.ok(Array.isArray(targets.customers[0].pushTokens));
assert.equal(await call(users.ownerB, 'owner_news_targets', { p_card_id: id }), null);
await pool.query(`update timbro.cards set news_at = now() - interval '1 hour' where id = $1`, [id]);
assert.equal(await call(users.ownerA, 'owner_news_targets', { p_card_id: id }), null, 'only right after sending');
await rejects(call(anon, 'owner_send_news', { p_card_id: id, p_text: 'x' }), /permission denied/);
ok('owners send one message a day to their own customers; nobody else can send it or read who gets it');

// ---- extras: Bring a friend, double-stamp hours, birthday gift, review link ----
const xid = 'testx-' + Date.now().toString(36);
const xdev = await call(anon, 'device_link', { p_code: (await call(users.ownerA, 'owner_link_code')).code, p_name: 'Cassa X' });
await call(users.ownerA, 'owner_save_card', { p_card: { id: xid, business: 'Bar Test', title: 'Carta', reward: 'un caffè', stampsNeeded: 8 } });
const person = (name, birth = '1990-03-03') => ({ p_card_id: xid, p_name: name, p_email: name.split(' ')[0].toLowerCase() + '@x.it', p_phone: '+393331234567', p_birth: birth });
const stamp = code => call(anon, 'stamper_stamp', { p_token: xdev.token, p_code: code, p_delta: 1 });
const look = async code => (await call(anon, 'stamper_lookup', { p_token: xdev.token, p_code: code })).customer;
const saveX = m => call(users.ownerA, 'owner_save_messages', { p_card_id: xid, p_messages: m });
let saved = await saveX({ double: { on: true, week: [3, 1, 9, 'x', 1], from: '15', to: 17 }, review: { on: true, url: 'javascript:alert(1)' }, birthday: { on: false, it: 'Auguri {name}!' } });
assert.deepEqual(saved.messages.double, { on: true, week: [1, 3], from: 15, to: 17 }); assert.equal(saved.messages.review.url, undefined);
assert.equal(saved.messages.birthday.on, false); assert.equal(saved.messages.birthday.it, 'Auguri {name}!');
saved = await saveX({ review: { on: true, url: 'https://g.page/r/abc/review' } });
assert.equal(saved.messages.review.url, 'https://g.page/r/abc/review'); assert.equal(saved.messages.friend, undefined);
ok('extras are saved cleaned: weekdays 1-7, hours, and only https review links');

const inviter = await call(anon, 'join_card', person('Anna Neri'));
const other = await call(anon, 'join_card', { ...person('Otto Blu'), p_card_id: id });
const f1 = await call(anon, 'join_card', { ...person('Bea Verdi'), p_ref: inviter.id.toLowerCase() });
const f2 = await call(anon, 'join_card', { ...person('Carla Gialli'), p_ref: other.id });   // an invite from another card counts for nothing
let r = await stamp(f1.id);
assert.equal(r.customer.stamps, 1); assert.equal(r.extra.friend, null, 'Bring a friend is off');
await saveX({ friend: { on: true } });
const f3 = await call(anon, 'join_card', { ...person('Dario Rosa'), p_ref: inviter.id });
r = await stamp(f3.id);
assert.equal(r.customer.stamps, 2); assert.equal(r.extra.friend, inviter.id);
assert.equal((await look(inviter.id)).stamps, 1); assert.equal((await look(inviter.id)).friends, 1); assert.ok((await look(inviter.id)).lastFriend > 0);
assert.equal((await stamp(f3.id)).customer.stamps, 3, 'only the first stamp has the friend bonus');
assert.equal((await stamp(f2.id)).customer.stamps, 1); assert.equal((await stamp(f1.id)).customer.stamps, 2, 'joined before it was on: already counted');
const visits = (await pool.query(`select count(*) filter (where type = 'stamp') v, count(*) filter (where type = 'bonus') b from timbro.events where customer_id = $1`, [f3.id])).rows[0];
assert.equal(+visits.v, 2); assert.equal(+visits.b, 1);
ok('Bring a friend: the first stamp gives the friend and the inviter one more each, once; visits still count once');

await saveX({ double: { on: true, week: [1, 2, 3, 4, 5, 6, 7], from: 0, to: 24 } });
r = await stamp(f1.id);
assert.equal(r.extra.double, true); assert.equal(r.customer.stamps, 4);
await saveX({ double: { on: true, week: [], from: 0, to: 24 } });
assert.equal((await stamp(f1.id)).customer.stamps, 5);
ok('double-stamp hours give two stamps only on the chosen days and hours');

const today = new Date(), bd = `${today.getFullYear() - 30}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const birthday = await call(anon, 'join_card', person('Elena Viola', bd.endsWith('02-29') ? '1992-02-28' : bd));
assert.equal((await look(birthday.id)).birthday, true); assert.equal((await look(f1.id)).birthday, false);
await rejects(call(anon, 'stamper_gift', { p_token: xdev.token, p_code: birthday.id }), /No birthday gift/, 'off by default');
await saveX({ birthday: { on: true } });
await rejects(call(anon, 'stamper_gift', { p_token: xdev.token, p_code: f1.id }), /No birthday gift/);
r = await call(anon, 'stamper_gift', { p_token: xdev.token, p_code: birthday.id });
assert.equal(r.customer.birthday, false); assert.equal(r.customer.history.at(-1).type, 'gift');
await rejects(call(anon, 'stamper_gift', { p_token: xdev.token, p_code: birthday.id }), /No birthday gift/, 'once a year');
await rejects(call(anon, 'stamper_gift', { p_token: 'nope', p_code: birthday.id }), /not linked/);
ok('birthday gift: only when switched on, in the birthday week, once a year, from a linked till');

// ---- alerts to Witkowski Design: sign-up (first card) and subscription changes ----
await pool.query(`insert into timbro.settings (name, value) values ('alerts_url', 'https://x.test/functions/v1/admin-alert') on conflict (name) do update set value = excluded.value`);
const calls = async () => (await pool.query(`select body from net.calls order by id`)).rows.map(r => r.body);
const before = (await calls()).length;
const alertUser = (await pool.query(`insert into auth.users (email) values ('alert-${Date.now()}@test.local') returning id`)).rows[0].id;
const alertOwner = { role: 'authenticated', sub: alertUser }, aid = 'alert-' + Date.now().toString(36);
await call(alertOwner, 'owner_save_card', { p_card: { id: aid, business: 'Bar Alert', title: 'Carta', reward: 'un caffè' } });
await call(alertOwner, 'owner_save_card', { p_card: { id: aid + 'b', business: 'Bar Alert', title: 'Carta 2', reward: 'un caffè' } });
let got = (await calls()).slice(before);
assert.equal(got.length, 1, 'one alert for the first card only'); assert.equal(got[0].kind, 'signup'); assert.equal(got[0].data.business, 'Bar Alert');
assert.match(got[0].data.email, /^alert-/); assert.deepEqual(got[0].data.cards, [aid]);
const key = (await pool.query(`select key from timbro.job_keys where name = 'alerts'`)).rows[0].key; assert.equal(got[0].key, key);
await call(alertOwner, 'owner_send_design', { p_card_id: aid, p_kind: 'proposal', p_design: { color: '#000000' }, p_note: 'Più scuro, per favore', p_images: [], p_links: [] });
await call(alertOwner, 'owner_save_card', { p_card: { id: aid, title: 'Carta nuova' } });   // the same request again: no new alert
got = (await calls()).slice(before);
assert.equal(got.at(-1).kind, 'design'); assert.equal(got.at(-1).data.card, aid); assert.equal(got.at(-1).data.note, 'Più scuro, per favore'); assert.equal(got.at(-1).data.request, false);
await call(users.designer, 'admin_publish', { p_card_id: aid, p_design: { color: '#000000' } });
got = (await calls()).slice(before);
assert.equal(got.at(-1).kind, 'approved'); assert.equal(got.at(-1).data.card, aid); assert.equal(got.at(-1).data.lang, 'it'); assert.match(got.at(-1).data.email, /^alert-/);
await call(users.designer, 'admin_ask_changes', { p_card_id: aid, p_reply: 'Manca il logo' });
got = (await calls()).slice(before);
assert.equal(got.at(-1).kind, 'changes'); assert.equal(got.at(-1).data.reply, 'Manca il logo');
const setBill = sql => pool.query(`update timbro.businesses set ${sql} where owner_id = $1`, [alertUser]);
await setBill(`billing_status = 'trialing', billing_plan = 'plus', billing_interval = 'month'`);
await setBill(`billing_period_end = now()`);   // nothing that matters changed: no alert
await setBill(`billing_status = 'active'`); await setBill(`billing_canceling = true`); await setBill(`billing_status = 'canceled'`);
got = (await calls()).slice(before);
assert.deepEqual(got.map(b => b.kind), ['signup', 'design', 'approved', 'changes', 'trial', 'paying', 'canceling', 'ended']); assert.equal(got[4].data.plan, 'plus');
await rejects(call(anon, 'alert_key_ok', { p_key: key }), /permission denied/);
assert.equal(await call({ role: 'service_role' }, 'alert_key_ok', { p_key: key }), true);
assert.equal(await call({ role: 'service_role' }, 'alert_key_ok', { p_key: 'nope' }), false);
ok('Witkowski Design is alerted at sign-up, when a design is sent for approval and at each subscription change; the café hears when its design is approved or needs a change; only the alert function can check the key');

// ---- online orders (Wolt, Uber Eats, Glovo, Deliveroo reports) ----
const T = Date.parse('2026-10-20T12:30:00Z');
const orders = [{ p: 'wolt', id: 'W1', t: T, v: 42.5, c: 'PLN' }, { p: 'wolt', id: 'W2', t: T + 36e5, v: 18, c: 'PLN' },
  { p: 'glovo', id: 'G1', t: T, v: 25, c: 'PLN' }, { p: 'evil', id: 'X', t: T, v: 1 }, { p: 'wolt', id: 'W3', t: 'soon', v: 5 }];
await rejects(call(anon, 'owner_import_orders', { p_card_id: id, p_orders: orders }), /permission denied/);
await rejects(call(users.ownerB, 'owner_import_orders', { p_card_id: id, p_orders: orders }), /another café/);
assert.equal((await call(users.ownerA, 'owner_import_orders', { p_card_id: id, p_orders: orders })).added, 3);
assert.equal((await call(users.ownerA, 'owner_import_orders', { p_card_id: id, p_orders: [{ ...orders[0], v: 44 }] })).added, 0);
const onl = await call(users.ownerA, 'owner_online_orders', { p_card_id: id });
assert.equal(onl.length, 3); assert.equal(Number(onl.find(o => o.id === 'W1').v), 44); assert.equal(onl[0].t, T);
await rejects(call(users.ownerB, 'owner_online_orders', { p_card_id: id }), /another café/);
await rejects(call(users.ownerA, 'owner_import_orders', { p_card_id: id, p_orders: Array(2001).fill(orders[0]) }), /Too many/);
assert.equal(await call(users.ownerA, 'owner_clear_orders', { p_card_id: id, p_platform: 'glovo' }), 1);
assert.equal((await call(users.ownerA, 'owner_online_orders', { p_card_id: id })).length, 2);
ok('only the café uploads, reads and removes its online orders; the same order twice is replaced, bad rows are skipped');

// ---- no function is open by accident (Postgres lets PUBLIC run new functions) ----
const open = async role => (await pool.query(`select coalesce(string_agg(p.proname, ',' order by p.proname), '') as f from pg_proc p
  join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'timbro' and has_function_privilege($1, p.oid, 'execute')`, [role])).rows[0].f.split(',').filter(Boolean);
const PUBLIC_FNS = ['device_link', 'get_card', 'get_my_card', 'join_card', 'reminders_due', 'stamper_gift', 'stamper_lookup', 'stamper_redeem', 'stamper_stamp', 'wallet_register', 'wallet_targets', 'wallet_unregister', 'wallet_updated'];
assert.deepEqual(await open('anon'), PUBLIC_FNS);
assert.deepEqual(await open('authenticated'), [...PUBLIC_FNS, 'admin_ask_changes', 'admin_cards', 'admin_publish', 'admin_set_plan',
  'owner_clear_orders', 'owner_data', 'owner_import_orders', 'owner_link_code', 'owner_news_targets', 'owner_online_orders', 'owner_remove_device', 'owner_save_card', 'owner_set_device_location', 'owner_save_messages', 'owner_send_design', 'owner_send_news'].sort());
ok('only the intended functions can be called by visitors and logged-in users');

console.log(`\nAll ${n} checks passed.`);
await pool.end();
