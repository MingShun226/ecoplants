"use server";

import { revalidatePath } from "next/cache";
import { normalisePhone } from "@/lib/account/phone";
import type { ActionResult } from "@/lib/admin/actions";
import {
  LOCALES,
  OFFER_AVAILABILITIES,
  PARTNER_STATUSES,
  PICKUP_DAYS,
  type LocaleCode,
  type OfferAvailability,
  type PartnerStatus,
  type PickupHours,
} from "@/lib/admin/enums";
import {
  malaysiaMidnight,
  malaysiaToday,
  nextDate,
  parseLocation,
  slugify,
} from "@/lib/admin/partner-format";
import { getSessionAdmin, hasRole } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Nursery mutations (ADR 0009).
 *
 * Same rules as every other action in the panel: each one re-checks the
 * session, because a server action is a public endpoint and the guarded layout
 * only protects the page. RLS and the column grant on `partners` refuse the
 * write underneath regardless — `kind`, for one, is not writable by any session.
 */

async function guard(): Promise<{ ok: false; error: string } | null> {
  const admin = await getSessionAdmin();
  return admin ? null : { ok: false, error: "Not signed in." };
}

/**
 * The database's refusals, in words someone at the nursery desk can act on.
 * Raised messages are already written that way and only lose their prefix;
 * constraint names are not, so the ones a form can trip are translated here.
 */
function readable(error: { message: string; code?: string }): string {
  const m = error.message;
  if (error.code === "23505" && m.includes("partners_slug_key")) {
    return "Another nursery already uses that web name.";
  }
  if (m.includes("partners_lat_check") || m.includes("partners_lng_check")) {
    return "That location is outside Malaysia. The smaller number (about 1 to 7) comes first.";
  }
  if (m.includes("partners_location_pair")) return "A location needs both numbers.";
  if (m.includes("partners_pickup_hours_check")) {
    return "Each open day needs an opening time before its closing time.";
  }
  if (m.includes("delivery_radius_km_check")) return "The delivery radius must be between 1 and 200 km.";
  if (m.includes("net_price_sen_check")) return "The nursery's price cannot be negative.";
  if (m.includes("account_no_check")) return "An account number is 6 to 20 digits.";
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "You do not have permission to change that.";
  }
  return m.replace(/^.*?(partners|partner_offers): /, "");
}

function refresh(slug?: string) {
  revalidatePath("/admin/partners", "layout");
  if (slug) revalidatePath(`/admin/partners/${slug}`);
  // Offers also show on each product's screen.
  revalidatePath("/admin/products", "layout");
}

/** Blank stays blank; anything else must be a mobile number we can WhatsApp. */
function whatsappOrError(raw: string): { value: string | null } | { error: string } {
  if (raw.trim() === "") return { value: null };
  const e164 = normalisePhone(raw);
  return e164 ? { value: e164 } : { error: `${raw.trim()} is not a Malaysian mobile number.` };
}

// ---------------------------------------------------------------- create --

export interface NewPartnerInput {
  displayName: string;
  name: string;
  areaLabel: string;
  contactName: string;
  whatsapp: string;
  preferredLocale: LocaleCode;
}

export async function createPartner(
  input: NewPartnerInput,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const denied = await guard();
  if (denied) return denied;

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "Give the nursery the name customers will read." };

  const base = slugify(displayName);
  if (!base) return { ok: false, error: "The name needs at least one letter or number in it." };

  const phone = whatsappOrError(input.whatsapp);
  if ("error" in phone) return { ok: false, error: phone.error };

  if (!LOCALES.includes(input.preferredLocale)) return { ok: false, error: "Choose a language." };

  const supabase = await createClient();

  // Two nurseries can share a trading name in different towns. Take the first
  // free suffix rather than refuse; the slug is a web name, not an identity.
  const { data: taken } = await supabase.from("partners").select("slug").like("slug", `${base}%`);
  const used = new Set(((taken ?? []) as { slug: string }[]).map((r) => r.slug));
  // `/admin/partners/new` is the add screen, so a nursery called "New" must
  // not be given the one address it could never be reached at.
  used.add("new");
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { error } = await supabase.from("partners").insert({
    slug,
    kind: "nursery",
    display_name: displayName,
    // The business name on the agreement often is the trading name. When it
    // differs it is filled in on the next screen, beside the bank details.
    name: input.name.trim() || displayName,
    area_label: input.areaLabel.trim(),
    contact_name: input.contactName.trim(),
    whatsapp: phone.value,
    preferred_locale: input.preferredLocale,
  });

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, slug };
}

// --------------------------------------------------------------- profile --

export interface PartnerProfileInput {
  displayName: string;
  name: string;
  areaLabel: string;
  address: string;
  contactName: string;
  whatsapp: string;
  preferredLocale: LocaleCode;
  agreementSignedOn: string;
  notes: string;
}

export async function updatePartnerProfile(
  partnerId: string,
  slug: string,
  input: PartnerProfileInput,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "The customer-facing name cannot be blank." };

  const phone = whatsappOrError(input.whatsapp);
  if ("error" in phone) return { ok: false, error: phone.error };

  if (!LOCALES.includes(input.preferredLocale)) return { ok: false, error: "Choose a language." };

  const signed = input.agreementSignedOn.trim();
  if (signed && !/^\d{4}-\d{2}-\d{2}$/.test(signed)) {
    return { ok: false, error: "The agreement date is not a date." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({
      display_name: displayName,
      name: input.name.trim() || displayName,
      area_label: input.areaLabel.trim(),
      address: input.address.trim(),
      contact_name: input.contactName.trim(),
      whatsapp: phone.value,
      preferred_locale: input.preferredLocale,
      agreement_signed_on: signed || null,
      notes: input.notes.trim(),
    })
    .eq("id", partnerId);

  if (error) return { ok: false, error: readable(error) };
  refresh(slug);
  return { ok: true };
}

// ---------------------------------------------------------------- orders --

export async function updatePartnerOrdering(
  partnerId: string,
  slug: string,
  input: { status: PartnerStatus; priority: number; selfDelivery: boolean },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (!PARTNER_STATUSES.includes(input.status)) return { ok: false, error: "Choose a status." };
  if (!Number.isInteger(input.priority) || Math.abs(input.priority) > 1000) {
    return { ok: false, error: "Priority is a whole number between -1000 and 1000." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ status: input.status, priority: input.priority, self_delivery: input.selfDelivery })
    .eq("id", partnerId);

  if (error) return { ok: false, error: readable(error) };
  refresh(slug);
  return { ok: true };
}

/**
 * "Closed today", or closed until a date, or open again.
 *
 * Stored as the instant the nursery reopens, so routing only ever asks
 * "is now before closed_until?". A date means closed up to midnight at the
 * start of it — "closed until 3 Feb" reopens on the morning of the 3rd.
 */
export async function setPartnerClosed(
  partnerId: string,
  slug: string,
  mode: { kind: "open" } | { kind: "today" } | { kind: "until"; date: string },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  let closedUntil: string | null = null;
  if (mode.kind === "today") {
    closedUntil = malaysiaMidnight(nextDate(malaysiaToday()));
  } else if (mode.kind === "until") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mode.date)) return { ok: false, error: "Choose a date." };
    if (mode.date <= malaysiaToday()) {
      return { ok: false, error: "Choose a date after today. For today only, use Closed today." };
    }
    closedUntil = malaysiaMidnight(mode.date);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partners").update({ closed_until: closedUntil }).eq("id", partnerId);

  if (error) return { ok: false, error: readable(error) };
  refresh(slug);
  return { ok: true };
}

// -------------------------------------------------------------- location --

export async function updatePartnerLocation(
  partnerId: string,
  slug: string,
  input: { location: string; radiusKm: number },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = parseLocation(input.location);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  if (!Number.isInteger(input.radiusKm) || input.radiusKm < 1 || input.radiusKm > 200) {
    return { ok: false, error: "The delivery radius must be a whole number of km, 1 to 200." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ lat: parsed.lat, lng: parsed.lng, delivery_radius_km: input.radiusKm })
    .eq("id", partnerId);

  if (error) return { ok: false, error: readable(error) };
  refresh(slug);
  return { ok: true };
}

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export async function updatePickupHours(
  partnerId: string,
  slug: string,
  hours: PickupHours,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  // Rebuilt from the known days rather than passed through, so a request
  // carrying extra keys is reduced to the shape the database accepts.
  const clean: PickupHours = {};
  for (const day of PICKUP_DAYS) {
    const h = hours[day];
    if (!h) {
      clean[day] = null;
      continue;
    }
    if (!TIME.test(h.open) || !TIME.test(h.close)) {
      return { ok: false, error: "Times are 24-hour, like 09:00 or 18:30." };
    }
    if (h.open >= h.close) {
      return { ok: false, error: "Each open day needs an opening time before its closing time." };
    }
    clean[day] = { open: h.open, close: h.close };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partners").update({ pickup_hours: clean }).eq("id", partnerId);

  if (error) return { ok: false, error: readable(error) };
  refresh(slug);
  return { ok: true };
}

// ---------------------------------------------------------------- offers --

export async function saveOffer(
  partnerId: string,
  variantId: string,
  input: { netPriceSen: number; availability: OfferAvailability },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (!Number.isInteger(input.netPriceSen) || input.netPriceSen < 0) {
    return { ok: false, error: "Enter what the nursery is paid, in ringgit." };
  }
  if (!OFFER_AVAILABILITIES.includes(input.availability)) {
    return { ok: false, error: "Choose whether it is available." };
  }

  const supabase = await createClient();
  // upsert: the same form adds an offer and edits one. `updated_by` is
  // stamped by the database from the session, never taken from here.
  const { error } = await supabase.from("partner_offers").upsert(
    {
      partner_id: partnerId,
      variant_id: variantId,
      net_price_sen: input.netPriceSen,
      availability: input.availability,
    },
    { onConflict: "partner_id,variant_id" },
  );

  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true };
}

export async function removeOffer(partnerId: string, variantId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_offers")
    .delete()
    .eq("partner_id", partnerId)
    .eq("variant_id", variantId);

  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true };
}

// -------------------------------------------------------- payout account --

export async function savePayoutAccount(
  partnerId: string,
  slug: string,
  input: { bankName: string; accountName: string; accountNo: string },
): Promise<ActionResult> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, error: "Not signed in." };
  // The policy refuses anyone else too; this only makes the refusal say why.
  if (!hasRole(admin, "owner")) return { ok: false, error: "Only the owner can change bank details." };

  const bankName = input.bankName.trim();
  const accountName = input.accountName.trim();
  // People copy account numbers with the spaces and dashes the bank app shows.
  const accountNo = input.accountNo.replace(/[\s-]/g, "");

  if (!bankName || !accountName) return { ok: false, error: "Bank and account name are both needed." };
  if (!/^[0-9]{6,20}$/.test(accountNo)) return { ok: false, error: "An account number is 6 to 20 digits." };

  const supabase = await createClient();
  const { error } = await supabase.from("partner_payout_accounts").upsert(
    { partner_id: partnerId, bank_name: bankName, account_name: accountName, account_no: accountNo },
    { onConflict: "partner_id" },
  );

  if (error) return { ok: false, error: readable(error) };
  refresh(slug);
  return { ok: true };
}
