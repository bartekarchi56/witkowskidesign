// Keeps the Instagram key alive. Keys from "Instagram API with Instagram Login" last 60 days;
// this renews it (run weekly by .github/workflows/instagram-token.yml) and, if Instagram
// hands back a new key, saves it into the repository secret IG_ACCESS_TOKEN.
// Needs: IG_ACCESS_TOKEN, and to save a new key GH_SECRETS_TOKEN (a GitHub token allowed to
// write this repository's Actions secrets) and GITHUB_REPOSITORY. Uses libsodium-wrappers.
const IG = process.env.IG_REFRESH_URL || 'https://graph.instagram.com/refresh_access_token';
const GH = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
const TOKEN = process.env.IG_ACCESS_TOKEN || '', GH_TOKEN = process.env.GH_SECRETS_TOKEN || '', REPO = process.env.GITHUB_REPOSITORY || '';

async function saveSecret(value) {
  const sodium = require('libsodium-wrappers'); await sodium.ready;
  const head = { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const key = await (await fetch(`${GH}/repos/${REPO}/actions/secrets/public-key`, { headers: head })).json();
  if (!key.key) throw new Error('GitHub refused to give the secrets key: check GH_SECRETS_TOKEN');
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL));
  const r = await fetch(`${GH}/repos/${REPO}/actions/secrets/IG_ACCESS_TOKEN`, { method: 'PUT', headers: { ...head, 'content-type': 'application/json' },
    body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: key.key_id }) });
  if (!r.ok) throw new Error(`GitHub did not save the new key (${r.status})`);
}

(async () => {
  if (!TOKEN) { console.log('No IG_ACCESS_TOKEN yet: nothing to renew.'); return; }
  const r = await fetch(`${IG}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(TOKEN)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Instagram did not renew the key: ${(j.error && j.error.message) || r.status}. Make a new key (README, "Automatic posting").`);
  const days = Math.round((j.expires_in || 0) / 86400);
  if (j.access_token === TOKEN) { console.log(`Key renewed: valid for ${days} more days.`); return; }
  if (!GH_TOKEN || !REPO) throw new Error('Instagram gave a new key, but GH_SECRETS_TOKEN is not set, so it cannot be saved.');
  await saveSecret(j.access_token);
  console.log(`New key saved to IG_ACCESS_TOKEN: valid for ${days} days.`);
})().catch(e => { console.error(e.message); process.exit(1); });
