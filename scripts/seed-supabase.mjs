/**
 * Перенос снимка данных (Google Sheets + GAS) в Supabase.
 *
 * Требуется service_role key (Settings → API), не используйте в браузере.
 *
 *   set SUPABASE_URL=https://xxxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node scripts/seed-supabase.mjs
 *
 * Обновить снимок CSV/JSON: экспорт из опубликованной таблицы и GAS ?action=get*
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(__dirname, 'migration-snapshot');

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

function readJson(name, fallback = null) {
  const p = path.join(SNAP, name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function boolCell(v) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === 'true' || s === 'да' || s === '1' || s === 'yes';
}

function parseMerchCsv(text) {
  const rows = parse(text, {
    relax_column_count: true,
    skip_empty_lines: true,
  });
  if (rows.length < 2) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (!values?.length) continue;
    const id = String(values[0] ?? '').trim();
    if (!id) continue;
    const preorder = boolCell(values[12]);
    const disabled = boolCell(values[13]);
    out.push({
      product_id: id,
      category: String(values[1] ?? '').trim(),
      name: String(values[2] ?? '').trim(),
      size: String(values[3] ?? '').trim(),
      quantity: parseInt(String(values[4] ?? '0'), 10) || 0,
      price: parseFloat(String(values[5] ?? '0')) || 0,
      image1: String(values[6] ?? '').trim(),
      image2: String(values[7] ?? '').trim(),
      image3: String(values[8] ?? '').trim(),
      image4: String(values[9] ?? '').trim(),
      capsule: String(values[10] ?? '').trim(),
      description: String(values[11] ?? '').trim(),
      preorder,
      disabled,
    });
  }
  return out;
}

function parseBannerCsv(text) {
  const rows = parse(text, { relax_column_count: true, skip_empty_lines: true });
  if (rows.length < 2) return [];
  const slides = [];
  for (let i = 1; i < rows.length; i++) {
    const url = String(rows[i][0] ?? '').trim();
    const slideText = String(rows[i][1] ?? '').trim();
    if (url.startsWith('http')) {
      slides.push({ image_url: url, slide_text: slideText });
    }
  }
  return slides;
}

async function clearTables() {
  await sb.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('orders').delete().neq('order_id', '');
  await sb.from('admin_logs').delete().gte('created_at', '1970-01-01T00:00:00Z');
  await sb.from('banner_slides').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('merch_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('catalog_capsules').delete().neq('name', '');
  await sb.from('catalog_sizes').delete().neq('name', '');
  await sb.from('catalog_categories').delete().neq('name', '');
  await sb.from('site_settings').delete().neq('key', '');
}

async function main() {
  console.log('Очистка таблиц (кроме auth)...');
  await clearTables();

  const merchPath = path.join(SNAP, '_merch_export.csv');
  if (!fs.existsSync(merchPath)) {
    console.error('Нет файла', merchPath);
    process.exit(1);
  }
  const merchRows = parseMerchCsv(fs.readFileSync(merchPath, 'utf8'));
  console.log('merch_lines:', merchRows.length);
  const batch = 200;
  for (let i = 0; i < merchRows.length; i += batch) {
    const chunk = merchRows.slice(i, i + batch);
    const { error } = await sb.from('merch_lines').insert(chunk);
    if (error) {
      console.error('merch insert', error);
      process.exit(1);
    }
  }

  const catJson = readJson('_gas_categories.json', { categories: [] });
  const categories = catJson.categories || [];
  const catRows = categories.map((name, sort_order) => ({ name, sort_order }));
  if (catRows.length) {
    const { error } = await sb.from('catalog_categories').insert(catRows);
    if (error) console.warn('categories', error.message);
  }

  const sizesJson = readJson('_gas_sizes.json', { sizes: [] });
  const sizes = sizesJson.sizes || [];
  const sizeRows = sizes.map((name, sort_order) => ({ name, sort_order }));
  if (sizeRows.length) {
    const { error } = await sb.from('catalog_sizes').insert(sizeRows);
    if (error) console.warn('sizes', error.message);
  }

  const capJson = readJson('_gas_capsules.json', { capsules: [] });
  const capsules = capJson.capsules || [];
  const capRows = capsules.map((c, sort_order) => ({
    name: c.name,
    color: c.color || '#0047BB',
    prefix: c.prefix || 'Капсула',
    outline: !!(c.outline === true || c.outline === 'true'),
    sort_order,
  }));
  if (capRows.length) {
    const { error } = await sb.from('catalog_capsules').insert(capRows);
    if (error) console.warn('capsules', error.message);
  }

  const bannerPath = path.join(SNAP, '_banner_export.csv');
  if (fs.existsSync(bannerPath)) {
    const slides = parseBannerCsv(fs.readFileSync(bannerPath, 'utf8'));
    const bannerRows = slides.map((s, sort_order) => ({ ...s, sort_order }));
    if (bannerRows.length) {
      const { error } = await sb.from('banner_slides').insert(bannerRows);
      if (error) console.warn('banner', error.message);
    }
  }

  await sb.from('site_settings').insert([
    { key: 'hero_title', value: 'Фирменная атрибутика' },
    { key: 'hero_subtitle', value: 'каталог для сотрудников компании' },
  ]);

  const logsJson = readJson('_gas_logs.json', { logs: [] });
  const logs = logsJson.logs || [];
  const logRows = logs.map((l) => {
    let dateDisplay = '';
    let timeDisplay = '';
    if (l.date && typeof l.date === 'string' && l.date.includes('T')) {
      try {
        const d = new Date(l.date);
        dateDisplay = d.toLocaleDateString('ru-RU');
        timeDisplay = d.toLocaleTimeString('ru-RU');
      } catch {
        dateDisplay = String(l.date);
        timeDisplay = String(l.time || '');
      }
    } else {
      dateDisplay = String(l.date ?? '');
      timeDisplay = String(l.time ?? '');
    }
    return {
      date_display: dateDisplay,
      time_display: timeDisplay,
      action: String(l.action || ''),
      details: String(l.details || ''),
      status: String(l.status || ''),
    };
  });
  for (let i = 0; i < logRows.length; i += batch) {
    const chunk = logRows.slice(i, i + batch);
    const { error } = await sb.from('admin_logs').insert(chunk);
    if (error) console.warn('logs chunk', error.message);
  }

  const ordersJson = readJson('_gas_orders.json', { orders: [] });
  const orders = ordersJson.orders || [];
  if (orders.length) {
    console.log('orders:', orders.length, '(ручной импорт при необходимости)');
  }

  console.log('Готово.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
