/**
 * Malaysian mobile numbers.
 *
 * A mirror of `normalise_my_phone()` in the database, and deliberately a
 * mirror rather than the only copy: the database is the authority — it is what
 * `place_order()` uses and what Supabase Auth stores — and this exists so a
 * customer finds out their number is wrong while they are typing it, not after
 * a round trip.
 *
 * Client-safe: no imports, no server-only code. The login and signup forms are
 * client components.
 *
 * If the rule changes, change it in `database/migrations/` first and bring this
 * into line. The two must agree, and the database wins.
 */

/**
 * E.164 for Malaysian mobiles: `60` then 9 or 10 digits starting `1`.
 *
 *   012-345 6789   10 national digits -> +60 12 345 6789
 *   011-1234 5678  11 national digits -> +60 11 1234 5678
 *
 * 011 and 015 carry one more digit than the rest, which is why this is a range.
 */
const MY_MOBILE = /^601[0-9]{8,9}$/;

/** Any way a Malaysian writes their number, to one string. `null` if invalid. */
export function normalisePhone(raw: string): string | null {
  let digits = raw.replace(/[^0-9]/g, "");

  if (digits.startsWith("60")) {
    // already country-coded
  } else if (digits.startsWith("0")) {
    digits = `60${digits.slice(1)}`; // drop the trunk zero
  } else {
    digits = `60${digits}`;
  }

  return MY_MOBILE.test(digits) ? `+${digits}` : null;
}

/**
 * Everything after `+60`, ungrouped. Absorbs a `60` or a leading `0` the
 * customer typed out of habit.
 */
function tail(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("60")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/**
 * Grouping is decided by the operator prefix, never by how many digits have
 * been typed so far. 011 and 015 run 2-4-4; everything else runs 2-3-4. Doing
 * it by length instead would regroup the number under the customer's cursor
 * halfway through, and would disagree with itself on a part-typed number.
 */
function group(digits: string): string[] {
  const long = /^1[15]/.test(digits);
  const sizes = long ? [2, 4, 4] : [2, 3, 4];
  const capped = digits.slice(0, long ? 10 : 9);

  const parts: string[] = [];
  let at = 0;
  for (const size of sizes) {
    if (at >= capped.length) break;
    parts.push(capped.slice(at, at + size));
    at += size;
  }
  return parts;
}

/**
 * Formats the national part as it is typed, for a field that already shows a
 * `+60` prefix beside it.
 *
 *   12345 6789    -> 12-345 6789     (010, 012, 013, 014, 016-019)
 *   111234 5678   -> 11-1234 5678    (011 and 015 carry one digit more)
 *
 * A leading zero is absorbed rather than rejected: half of Malaysia types
 * `012…` out of habit even when the box says `+60`, and quietly doing the right
 * thing beats an error message about a digit we can infer.
 */
export function formatPhoneInput(raw: string): string {
  const parts = group(tail(raw));
  // 12-345 6789: a hyphen after the operator prefix, a space inside the number.
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts[0]}-${parts.slice(1).join(" ")}`;
}

/** `+60123456789` -> `012-345 6789`, for showing a number back to its owner. */
export function formatPhone(e164: string): string {
  const parts = group(tail(e164));
  if (parts.length === 0) return e164;
  // Same grouping as the input field, with the trunk zero back on the front —
  // that is how a Malaysian reads their own number aloud.
  return parts.length === 1 ? `0${parts[0]}` : `0${parts[0]}-${parts.slice(1).join(" ")}`;
}

/**
 * The address Supabase Auth stores this number under.
 *
 * Supabase ties its `phone` identity type to the SMS subsystem: the Phone
 * provider cannot be saved without an SMS provider configured, even when
 * nothing will ever be sent. This shop authenticates on a password and sends no
 * codes, so that subsystem is skipped entirely and the number is carried as an
 * address instead.
 *
 * **Nobody ever sees or types this.** The customer enters a phone number, the
 * account page shows a phone number, and `customers.phone` holds the real
 * E.164. This exists only because Supabase needs a unique string to key an
 * identity on, and a phone number is a perfectly good one.
 *
 * The subdomain is load-bearing. Staff are keyed the same way on
 * `@staff.ecoplants.my`, so the two namespaces cannot overlap, and neither can
 * ever collide with a real mailbox on `ecoplants.my` itself.
 */
const AUTH_DOMAIN = "phone.ecoplants.my";

export function toAuthEmail(e164: string): string {
  return `${e164.replace(/^\+/, "")}@${AUTH_DOMAIN}`;
}

export const PASSWORD_MIN = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`;
  }
  return null;
}
