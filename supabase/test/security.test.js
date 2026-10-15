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

// ---- no function is open by accident (Postgres lets PUBLIC run new functions) ----
const open = async role => (await pool.query(`select coalesce(string_agg(p.proname, ',' order by p.proname), '') as f from pg_proc p
  join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'timbro' and has_function_privilege($1, p.oid, 'execute')`, [role])).rows[0].f.split(',').filter(Boolean);
const PUBLIC_FNS = ['device_link', 'get_card', 'get_my_card', 'join_card', 'reminders_due', 'stamper_lookup', 'stamper_redeem', 'stamper_stamp', 'wallet_register', 'wallet_targets', 'wallet_unregister', 'wallet_updated'];
assert.deepEqual(await open('anon'), PUBLIC_FNS);
assert.deepEqual(await open('authenticated'), [...PUBLIC_FNS, 'admin_ask_changes', 'admin_cards', 'admin_publish', 'admin_set_plan',
  'owner_data', 'owner_link_code', 'owner_remove_device', 'owner_save_card', 'owner_save_messages', 'owner_send_design'].sort());
ok('only the intended functions can be called by visitors and logged-in users');

console.log(`\nAll ${n} checks passed.`);
await pool.end();
