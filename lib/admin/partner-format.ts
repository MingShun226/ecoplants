/**
 * Small rules about nurseries that the forms and the server actions both need.
 *
 * Client-safe on purpose (no `server-only`, no Supabase): the form checks a
 * pasted location while it is being typed, and the action checks it again on
 * the way in, so the two must be the same function or they will disagree.
 * The database has the last word either way (0032's check constraints).
 */

/** The box 0032 accepts. Peninsular and East Malaysia both fall inside it. */
export const MALAYSIA = { latMin: 0.5, latMax: 7.6, lngMin: 99.5, lngMax: 119.5 } as const;

export type ParsedLocation =
  | { ok: true; lat: number; lng: number }
  | { ok: true; lat: null; lng: null }
  | { ok: false; error: string };

/**
 * A location as staff will actually paste it.
 *
 * Right-clicking a spot in Google Maps copies "3.20457, 101.57951". A shared
 * Maps link carries the same pair after an "@" or a "q=". Both work here, as
 * does a pair separated by a space. Blank clears it.
 *
 * Swapped coordinates are the one mistake worth naming, because they are the
 * likeliest and the database's refusal ("violates check constraint") would not
 * say what to do about it.
 */
export function parseLocation(input: string): ParsedLocation {
  const text = input.trim();
  if (text === "") return { ok: true, lat: null, lng: null };

  const match =
    text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    text.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    text.match(/^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*\)?\s*$/);

  if (!match) {
    return {
      ok: false,
      error: "Paste the two numbers from Google Maps, like 3.20457, 101.57951.",
    };
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  const inside = (a: number, b: number) =>
    a >= MALAYSIA.latMin && a <= MALAYSIA.latMax && b >= MALAYSIA.lngMin && b <= MALAYSIA.lngMax;

  if (inside(lat, lng)) return { ok: true, lat, lng };
  if (inside(lng, lat)) {
    return {
      ok: false,
      error: "Those look the wrong way round. The smaller number (about 1 to 7) comes first.",
    };
  }
  return { ok: false, error: "That point is outside Malaysia." };
}

export function formatLocation(lat: number | null, lng: number | null): string {
  return lat === null || lng === null ? "" : `${lat}, ${lng}`;
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * What EcoPlants keeps on one: the customer's price less the nursery's.
 * The percentage is of the customer's price, which is how a margin is read.
 */
export function marginOf(retailSen: number, netSen: number): { sen: number; pct: number | null } {
  const sen = retailSen - netSen;
  return { sen, pct: retailSen > 0 ? Math.round((sen / retailSen) * 100) : null };
}

/** "extra-large" -> "Extra large". The panel is English-only (ADR 0006). */
export function sizeLabel(key: string): string {
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "my-nursery" from "My Nursery!" — the same rule as product slugs. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Midnight at the start of a Malaysian calendar date, as an instant.
 * Malaysia keeps +08:00 all year, so a fixed offset is exact.
 */
export function malaysiaMidnight(isoDate: string): string {
  return `${isoDate}T00:00:00+08:00`;
}

/** Today's date in Malaysia, "YYYY-MM-DD", whatever the server's own zone. */
export function malaysiaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The Malaysian date after `isoDate`. */
export function nextDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
