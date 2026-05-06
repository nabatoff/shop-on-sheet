/**
 * Скачивает внешние URL из image1–image4 (merch_lines) и banner_slides,
 * загружает в bucket merch-images, перезаписывает строки на public URL Supabase.
 *
 * Требует service_role (Dashboard → Settings → API):
 *
 *   set SUPABASE_URL=https://xxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node scripts/migrate-remote-images-to-storage.mjs
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dryRun = process.argv.includes('--dry-run');

if (!url || !serviceKey) {
  console.error('Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const OUR_PREFIX = `${url.replace(/\/$/, '')}/storage/v1/object/public/merch-images/`;

function extFrom(ct, pathname) {
  const c = (ct || '').split(';')[0].trim().toLowerCase();
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  if (map[c]) return map[c];
  const m = pathname.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  if (m) return '.' + m[1].toLowerCase().replace('jpeg', 'jpg');
  return '.bin';
}

function hashSlug(u) {
  return crypto.createHash('sha256').update(u).digest('hex').slice(0, 32);
}

async function fetchBuffer(remoteUrl) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(remoteUrl, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'shop-on-sheets-migrate/1',
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type');
    let pathname = '';
    try {
      pathname = new URL(remoteUrl).pathname;
    } catch {
      pathname = '';
    }
    const ext = extFrom(ct, pathname);
    return { buf, ext, ct: ct?.split(';')[0]?.trim() || 'application/octet-stream' };
  } finally {
    clearTimeout(t);
  }
}

async function ensureMapping(remoteUrl, cache) {
  if (!remoteUrl || typeof remoteUrl !== 'string') return remoteUrl || '';
  const u = remoteUrl.trim();
  if (!u.startsWith('http')) return u;
  if (u.startsWith(OUR_PREFIX) || u.includes('/storage/v1/object/public/merch-images/')) return u;

  if (cache.has(u)) return cache.get(u);

  let pathname = '';
  try {
    pathname = new URL(u).pathname;
  } catch {
    return u;
  }

  const slug = hashSlug(u);
  const { buf, ext: extGuess, ct } = await fetchBuffer(u);
  const ext = extGuess === '.bin' ? extFrom(ct, pathname) : extGuess;
  const objectPath = `imported/${slug}${ext}`;

  if (dryRun) {
    const { data } = sb.storage.from('merch-images').getPublicUrl(objectPath);
    cache.set(u, data.publicUrl);
    return data.publicUrl;
  }

  const { error: upErr } = await sb.storage.from('merch-images').upload(objectPath, buf, {
    contentType: ct.startsWith('image/') ? ct : 'application/octet-stream',
    upsert: true,
  });
  if (upErr && !String(upErr.message).toLowerCase().includes('duplicate')) {
    console.warn('upload fail', objectPath, upErr.message);
    cache.set(u, u);
    return u;
  }
  const pub = sb.storage.from('merch-images').getPublicUrl(objectPath).data.publicUrl;
  cache.set(u, pub);
  return pub;
}

async function main() {
  const cache = new Map();

  let offset = 0;
  const page = 300;
  for (;;) {
    const { data: rows, error } = await sb
      .from('merch_lines')
      .select('id,image1,image2,image3,image4')
      .range(offset, offset + page - 1);
    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      const i1 = await ensureMapping(row.image1, cache);
      await new Promise((r) => setTimeout(r, 30));
      const i2 = await ensureMapping(row.image2, cache);
      await new Promise((r) => setTimeout(r, 30));
      const i3 = await ensureMapping(row.image3, cache);
      await new Promise((r) => setTimeout(r, 30));
      const i4 = await ensureMapping(row.image4, cache);

      if (i1 === row.image1 && i2 === row.image2 && i3 === row.image3 && i4 === row.image4) continue;

      if (dryRun) {
        console.log('[dry]', row.id, row.image1, '->', i1);
        continue;
      }

      const { error: upd } = await sb
        .from('merch_lines')
        .update({ image1: i1, image2: i2, image3: i3, image4: i4 })
        .eq('id', row.id);
      if (upd) console.warn('row update', row.id, upd.message);
    }
    offset += rows.length;
    if (rows.length < page) break;
  }

  const { data: banners, error: bErr } = await sb.from('banner_slides').select('id,image_url,sort_order');
  if (!bErr && banners?.length) {
    for (const b of banners) {
      const nu = await ensureMapping(b.image_url, cache);
      await new Promise((r) => setTimeout(r, 30));
      if (dryRun || nu === b.image_url) continue;
      const { error: upe } = await sb.from('banner_slides').update({ image_url: nu }).eq('id', b.id);
      if (upe) console.warn('banner', b.id, upe.message);
    }
  }

  console.log(dryRun ? 'Dry-run done.' : 'Done. Mapped', cache.size, 'unique URLs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
