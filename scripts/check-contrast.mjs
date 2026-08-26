/**
 * WCAG contrast auditor for the EcoPlants palette.
 *
 * Reads the tokens straight out of app/globals.css rather than keeping a copy
 * here — a duplicated palette drifts from the stylesheet within a week, and a
 * contrast test that audits stale values is worse than no test.
 *
 * The palette is authored in OKLCH, so this converts OKLCH → OKLab → linear
 * sRGB and takes relative luminance from the linear values directly.
 *
 * Run: npm run check:contrast
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'app', 'globals.css'), 'utf8');

/* ---------------------------------------------------------------- parsing */

/** Every `--token: value;` declaration, first definition wins (:root). */
function parseTokens(source) {
  const tokens = new Map();
  const re = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim;
  let match;
  while ((match = re.exec(source)) !== null) {
    const [, name, value] = match;
    if (!tokens.has(name)) tokens.set(name, value.trim());
  }
  return tokens;
}

const tokens = parseTokens(css);

/** Follows `var(--x)` chains until an actual colour function is reached. */
function resolve(name, depth = 0) {
  if (depth > 12) throw new Error(`Token cycle at ${name}`);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Unknown token ${name}`);
  const varRef = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (varRef) return resolve(varRef[1], depth + 1);
  return value;
}

/** `oklch(0.663 0.117 39)` → { l, c, h }. Alpha is not used for contrast. */
function parseOklch(value) {
  const match = value.match(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i
  );
  if (!match) throw new Error(`Not an oklch() value: ${value}`);
  const [, rawL, c, h] = match;
  const l = rawL.endsWith('%') ? parseFloat(rawL) / 100 : parseFloat(rawL);
  return { l, c: parseFloat(c), h: parseFloat(h) };
}

/* ------------------------------------------------------------- conversion */

/** OKLCH → linear sRGB. Björn Ottosson's matrices. */
function oklchToLinearSrgb({ l: L, c: C, h: H }) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Relative luminance. Out-of-gamut channels are clamped, which is exactly what
 * a browser does when it renders the colour, so the measured ratio matches
 * what a user actually sees.
 */
function luminance(name) {
  const { r, g, b } = oklchToLinearSrgb(parseOklch(resolve(name)));
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

/** True when any channel falls outside sRGB — the colour will be clipped. */
function outOfGamut(name) {
  const { r, g, b } = oklchToLinearSrgb(parseOklch(resolve(name)));
  return [r, g, b].some((v) => v < -0.001 || v > 1.001);
}

function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ pairs */

/** [foreground, background, usage, minimum required ratio] */
const pairs = [
  // Body copy on the semantic surfaces
  ['--text-primary', '--canvas', 'Body text on page ground', 4.5],
  ['--text-primary', '--surface', 'Body text on cards', 4.5],
  ['--text-primary', '--surface-sunken', 'Body text on sunken sections', 4.5],
  ['--text-secondary', '--canvas', 'Secondary copy on page ground', 4.5],
  ['--text-secondary', '--surface', 'Secondary copy on cards', 4.5],
  ['--text-tertiary', '--canvas', 'Captions and meta on page ground', 4.5],
  ['--text-tertiary', '--surface-sunken', 'Meta on sunken sections', 4.5],
  ['--text-accent', '--canvas', 'Accent links on page ground', 4.5],
  ['--text-accent', '--surface', 'Accent links on cards', 4.5],

  // Clay — the accent, reserved for actions and badges
  ['--color-ink-50', '--color-clay-600', 'Label on primary button', 4.5],
  ['--color-ink-50', '--color-clay-700', 'Label on primary button (hover)', 4.5],
  ['--color-clay-700', '--color-clay-50', 'Accent text on tinted chip', 4.5],
  ['--color-clay-800', '--color-clay-100', 'Badge text on clay chip', 4.5],
  ['--color-clay-800', '--color-sand-50', 'Accent text on warm panel', 4.5],

  // Leaf — structural chrome
  ['--color-ink-50', '--color-leaf-700', 'White text on leaf surface', 4.5],
  ['--color-ink-50', '--color-leaf-950', 'White text on dark editorial band', 4.5],
  ['--color-leaf-800', '--canvas', 'Leaf heading on page ground', 4.5],
  ['--color-leaf-900', '--color-leaf-100', 'Eco badge text on leaf chip', 4.5],
  ['--color-leaf-300', '--color-leaf-950', 'Accent text on dark band', 4.5],
  ['--color-leaf-100', '--color-leaf-950', 'Muted text on dark band', 4.5],

  // Inverted chrome — the .on-dark token remap
  ['--color-ink-50', '--surface-inverse', 'Header text over the dark hero', 4.5],

  // Status
  ['--color-ink-50', '--color-success', 'In-stock badge label', 4.5],
  ['--color-ink-50', '--color-danger', 'Sold-out / error label', 4.5],
  ['--color-warning', '--canvas', 'Low-stock warning text', 4.5],
  ['--color-success', '--canvas', 'In-stock text on page ground', 4.5],

  // Large text and non-text — 3:1
  ['--color-clay-500', '--canvas', 'Display-size text in clay', 3],
  ['--color-leaf-600', '--canvas', 'Icon stroke on page ground', 3],
  ['--color-clay-600', '--canvas', 'Focus ring against page ground', 3],
  ['--border-strong', '--canvas', 'Strong border against page ground', 3],
];

/**
 * Documented so nobody rediscovers them by accident. These must stay BELOW
 * 4.5:1 — if one starts passing, the ramp has drifted and the note is stale.
 */
const forbidden = [
  ['--color-leaf-400', '--surface', 'Sage is a surface colour, never body text'],
  ['--color-leaf-400', '--canvas', 'Sage is a surface colour, never body text'],
  ['--color-clay-500', '--color-clay-100', 'Light clay on peach'],
  ['--color-leaf-600', '--color-leaf-500', 'Green-on-green'],
];

/* ----------------------------------------------------------------- report */

const w = (s, n) => String(s).padEnd(n);
let failures = 0;

console.log('');
console.log(w('FOREGROUND', 22) + w('BACKGROUND', 22) + w('RATIO', 9) + w('NEEDS', 7) + w('', 6) + 'USAGE');
console.log('-'.repeat(118));

for (const [fg, bg, usage, min] of pairs) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass) failures++;
  console.log(
    w(fg.replace('--', ''), 22) +
      w(bg.replace('--', ''), 22) +
      w(`${r.toFixed(2)}:1`, 9) +
      w(`${min}:1`, 7) +
      w(pass ? 'PASS' : 'FAIL', 6) +
      usage
  );
}
console.log('-'.repeat(118));

console.log('\nFORBIDDEN PAIRS (must stay below 4.5:1 — never use for text)');
for (const [fg, bg, why] of forbidden) {
  const r = ratio(fg, bg);
  const stillForbidden = r < 4.5;
  if (!stillForbidden) failures++;
  console.log(
    `  ${w(fg.replace('--', ''), 20)} on ${w(bg.replace('--', ''), 20)} ${w(`${r.toFixed(2)}:1`, 9)}` +
      `${stillForbidden ? '' : '  ← NOW PASSES, note is stale'}  — ${why}`
  );
}

// A colour outside sRGB gets clipped by the browser, which changes both its
// appearance and its measured contrast. Worth knowing about explicitly.
const clipped = [...tokens.keys()].filter((name) => {
  try {
    return resolve(name).includes('oklch(') && outOfGamut(name);
  } catch {
    return false;
  }
});
if (clipped.length > 0) {
  console.log(`\nOUT OF sRGB GAMUT (clipped on render): ${clipped.join(', ')}`);
}

console.log('');
if (failures > 0) {
  console.error(`${failures} contrast failure(s). Fix the token, not the test.`);
  process.exit(1);
}
console.log(`All ${pairs.length} shipped token pairs meet WCAG AA.`);
