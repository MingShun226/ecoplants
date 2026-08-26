/**
 * Dumps the live catalogue to database/seeds/0001_catalogue.sql.
 *
 * This replaces the old generator, which read a parallel set of TypeScript
 * fixtures. Now that the catalogue lives in Postgres, keeping a second copy in
 * the repo is the drift problem the generator existed to avoid — just pointed
 * the other way. The database is the source of truth; this file makes it
 * reproducible on a fresh project.
 *
 * Reads as `anon`, so it can only see what the storefront can see. That is the
 * point: if this dump is complete, the storefront's view is complete.
 *
 * Run: npm run dump:seed
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env.local reader — not worth a dependency for two values. */
async function loadEnv() {
  const raw = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = await loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (values) =>
  !values || values.length === 0 ? "'{}'" : `ARRAY[${values.map(q).join(", ")}]`;

const LOCALE_ORDER = { en: 0, ms: 1, zh: 2 };

/* ------------------------------------------------------------------ read -- */

const { data: categories, error: catErr } = await supabase
  .from("categories")
  .select("slug, kind, position, is_derived, category_translations ( locale, name, description )")
  .order("position");
if (catErr) throw new Error(`categories: ${catErr.message}`);

const { data: products, error: prodErr } = await supabase
  .from("products")
  .select(`
    ref, name_botanical, badges, rating, review_count, peninsular_only, is_active,
    categories!inner ( slug ),
    product_translations ( locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note ),
    plant_attributes ( light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying ),
    product_variants ( sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position, inventory ( quantity_on_hand ) )
  `)
  .order("ref");
if (prodErr) throw new Error(`products: ${prodErr.message}`);

/* ----------------------------------------------------------------- write -- */

const out = [];
const w = (line = "") => out.push(line);

w("-- 0001_catalogue.sql");
w("--");
w("-- GENERATED FILE — do not edit by hand.");
w("-- Dumped from the live catalogue: npm run dump:seed");
w("--");
w("-- Idempotent. products.ref and product_variants.sku are the natural keys, so");
w("-- every statement is an upsert and the file is safe to re-run.");
w("--");
w("-- Inventory is the one exception: it inserts ON CONFLICT DO NOTHING, because");
w("-- a re-run must not silently restore stock that has since been sold.");
w();
w("begin;");
w();

w("-- ----------------------------------------------------------- categories --");
w("insert into categories (slug, kind, position, is_derived) values");
w(
  categories
    .map((c) => `  (${q(c.slug)}, ${q(c.kind)}, ${c.position}, ${c.is_derived})`)
    .join(",\n"),
);
w("on conflict (slug) do update set");
w("  kind = excluded.kind, position = excluded.position, is_derived = excluded.is_derived;");
w();

const catTranslations = categories.flatMap((c) =>
  [...c.category_translations]
    .sort((a, b) => LOCALE_ORDER[a.locale] - LOCALE_ORDER[b.locale])
    .map((t) => `  (${q(c.slug)}, ${q(t.locale)}, ${q(t.name)}, ${q(t.description)})`),
);
w("insert into category_translations (category_id, locale, name, description)");
w("select c.id, v.locale::locale_code, v.name, v.description");
w("from (values");
w(catTranslations.join(",\n"));
w(") as v(slug, locale, name, description)");
w("join categories c on c.slug = v.slug");
w("on conflict (category_id, locale) do update set");
w("  name = excluded.name, description = excluded.description;");
w();

w("-- ------------------------------------------------------------- products --");
w("insert into products (ref, name_botanical, category_id, badges, rating, review_count, peninsular_only, is_active)");
w("select v.ref, v.name_botanical, c.id, v.badges, v.rating, v.review_count, v.peninsular_only, v.is_active");
w("from (values");
w(
  products
    .map(
      (p) =>
        `  (${q(p.ref)}, ${q(p.name_botanical)}, ${q(p.categories.slug)}, ${arr(p.badges)}, ${p.rating}::numeric(2,1), ${p.review_count}, ${p.peninsular_only}, ${p.is_active})`,
    )
    .join(",\n"),
);
w(") as v(ref, name_botanical, category_slug, badges, rating, review_count, peninsular_only, is_active)");
w("join categories c on c.slug = v.category_slug");
w("on conflict (ref) do update set");
w("  name_botanical = excluded.name_botanical, category_id = excluded.category_id,");
w("  badges = excluded.badges, rating = excluded.rating, review_count = excluded.review_count,");
w("  peninsular_only = excluded.peninsular_only, is_active = excluded.is_active;");
w();

w("-- ----------------------------------------------------------- attributes --");
w("-- pet_safe NULL means unverified against the ASPCA database. Never render");
w("-- that as safe.");
w("insert into plant_attributes (product_id, light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying)");
w("select p.id, v.light::light_level, v.water::water_frequency, v.pet_safe,");
w("       v.difficulty::care_difficulty, v.mature_height_cm, v.placement::plant_placement, v.air_purifying");
w("from (values");
w(
  products
    .map((p) => {
      const a = p.plant_attributes;
      return `  (${q(p.ref)}, ${q(a.light)}, ${q(a.water)}, ${a.pet_safe === null ? "NULL" : a.pet_safe}::boolean, ${q(a.difficulty)}, ${a.mature_height_cm}, ${q(a.placement)}, ${a.air_purifying})`;
    })
    .join(",\n"),
);
w(") as v(ref, light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying)");
w("join products p on p.ref = v.ref");
w("on conflict (product_id) do update set");
w("  light = excluded.light, water = excluded.water, pet_safe = excluded.pet_safe,");
w("  difficulty = excluded.difficulty, mature_height_cm = excluded.mature_height_cm,");
w("  placement = excluded.placement, air_purifying = excluded.air_purifying;");
w();

w("-- ---------------------------------------------------------- translations --");
w("-- Slugs are localised: /en/plants/snake-plant, /ms/plants/pokok-lidah-jin,");
w("-- /zh/plants/huweilan. The (locale, slug) unique index is what makes each a");
w("-- single indexed lookup.");
w("insert into product_translations (product_id, locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note)");
w("select p.id, v.locale::locale_code, v.name, v.slug, v.tagline, v.description, v.care_summary, v.climate_note, v.toxicity_note");
w("from (values");
w(
  products
    .flatMap((p) =>
      [...p.product_translations]
        .sort((a, b) => LOCALE_ORDER[a.locale] - LOCALE_ORDER[b.locale])
        .map(
          (t) =>
            `  (${q(p.ref)}, ${q(t.locale)}, ${q(t.name)}, ${q(t.slug)}, ${q(t.tagline)},\n` +
            `   ${q(t.description)},\n` +
            `   ${q(t.care_summary)},\n` +
            `   ${q(t.climate_note)}, ${q(t.toxicity_note)})`,
        ),
    )
    .join(",\n"),
);
w(") as v(ref, locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note)");
w("join products p on p.ref = v.ref");
w("on conflict (product_id, locale) do update set");
w("  name = excluded.name, slug = excluded.slug, tagline = excluded.tagline,");
w("  description = excluded.description, care_summary = excluded.care_summary,");
w("  climate_note = excluded.climate_note, toxicity_note = excluded.toxicity_note;");
w();

const variants = products.flatMap((p) =>
  [...p.product_variants].sort((a, b) => a.position - b.position).map((v) => ({ ref: p.ref, ...v })),
);

w("-- ------------------------------------------------------------- variants --");
w("-- price_sen is integer sen. 1 MYR = 100 sen.");
w("insert into product_variants (product_id, sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position)");
w("select p.id, v.sku, v.size_key, v.pot_color_key, v.pot_material_key,");
w("       v.price_sen, v.compare_at_sen, v.weight_grams, v.height_cm, v.pot_diameter_cm, v.position");
w("from (values");
w(
  variants
    .map(
      (v) =>
        `  (${q(v.ref)}, ${q(v.sku)}, ${q(v.size_key)}, ${q(v.pot_color_key)}, ${q(v.pot_material_key)}, ${v.price_sen}, ${v.compare_at_sen ?? "NULL"}::integer, ${v.weight_grams}, ${v.height_cm}, ${v.pot_diameter_cm}, ${v.position})`,
    )
    .join(",\n"),
);
w(") as v(ref, sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position)");
w("join products p on p.ref = v.ref");
w("on conflict (sku) do update set");
w("  size_key = excluded.size_key, pot_color_key = excluded.pot_color_key,");
w("  pot_material_key = excluded.pot_material_key, price_sen = excluded.price_sen,");
w("  compare_at_sen = excluded.compare_at_sen, weight_grams = excluded.weight_grams,");
w("  height_cm = excluded.height_cm, pot_diameter_cm = excluded.pot_diameter_cm,");
w("  position = excluded.position;");
w();

w("-- ------------------------------------------------------------ inventory --");
w("-- DO NOTHING, not DO UPDATE: a re-run must not restore stock that has sold.");
w("insert into inventory (variant_id, quantity_on_hand)");
w("select pv.id, v.qty");
w("from (values");
w(variants.map((v) => `  (${q(v.sku)}, ${v.inventory?.quantity_on_hand ?? 0})`).join(",\n"));
w(") as v(sku, qty)");
w("join product_variants pv on pv.sku = v.sku");
w("on conflict (variant_id) do nothing;");
w();
w("commit;");
w();

const sql = out.join("\n");
await writeFile(join(root, "database", "seeds", "0001_catalogue.sql"), sql, "utf8");

console.log(
  `Wrote database/seeds/0001_catalogue.sql (${(sql.length / 1024).toFixed(1)} KB)\n` +
    `  ${categories.length} categories · ${products.length} products · ` +
    `${products.reduce((n, p) => n + p.product_translations.length, 0)} translations · ` +
    `${variants.length} variants`,
);
