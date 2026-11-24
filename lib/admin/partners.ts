import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  LocaleCode,
  OfferAvailability,
  PartnerKind,
  PartnerStatus,
  PickupHours,
} from "@/lib/admin/enums";

/**
 * Partner nurseries, for the panel (ADR 0009).
 *
 * Reads go through the admin's own session like everything else here, so RLS
 * decides what comes back: every admin sees nurseries and their offers, and
 * only the owner sees where a nursery is paid. A staff session asking for a
 * payout account gets `null`, not an error — the same answer as "none on file",
 * which is why the page decides whether to show that card from the role, not
 * from the result.
 */

export interface PartnerSummary {
  id: string;
  slug: string;
  kind: PartnerKind;
  name: string;
  displayName: string;
  areaLabel: string;
  status: PartnerStatus;
  contactName: string;
  whatsapp: string | null;
  hasLocation: boolean;
  radiusKm: number;
  closedUntil: string | null;
  selfDelivery: boolean;
  offerCount: number;
}

export interface PartnerDetail extends PartnerSummary {
  address: string;
  lat: number | null;
  lng: number | null;
  pickupHours: PickupHours;
  priority: number;
  preferredLocale: LocaleCode;
  agreementSignedOn: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  offers: PartnerOfferRow[];
}

export interface PartnerOfferRow {
  variantId: string;
  sku: string;
  sizeKey: string;
  productRef: string;
  productName: string;
  productActive: boolean;
  priceSen: number;
  netPriceSen: number;
  availability: OfferAvailability;
  updatedAt: string;
}

export interface PayoutAccount {
  bankName: string;
  accountName: string;
  accountNo: string;
  updatedAt: string;
}

/** One nursery's offer on a product, for the product screen. */
export interface ProductOfferRow {
  variantId: string;
  partnerId: string;
  partnerSlug: string;
  partnerName: string;
  partnerArea: string;
  partnerStatus: PartnerStatus;
  netPriceSen: number;
  availability: OfferAvailability;
}

export interface NurseryOption {
  id: string;
  slug: string;
  displayName: string;
  areaLabel: string;
  status: PartnerStatus;
}

export interface VariantOption {
  id: string;
  sku: string;
  sizeKey: string;
  priceSen: number;
  productRef: string;
  productName: string;
  productActive: boolean;
}

// ------------------------------------------------------------------ rows --

const SUMMARY_COLUMNS = `
  id, slug, kind, name, display_name, area_label, status, contact_name,
  whatsapp, lat, radius:delivery_radius_km, closed_until, self_delivery
`;

interface SummaryRow {
  id: string;
  slug: string;
  kind: PartnerKind;
  name: string;
  display_name: string;
  area_label: string;
  status: PartnerStatus;
  contact_name: string;
  whatsapp: string | null;
  lat: number | null;
  radius: number;
  closed_until: string | null;
  self_delivery: boolean;
  partner_offers: { count: number }[] | null;
}

interface TranslationName {
  locale: LocaleCode;
  name: string;
}

interface VariantEmbed {
  id: string;
  sku: string;
  size_key: string;
  price_sen: number;
  position: number;
  products: {
    ref: string;
    is_active: boolean;
    product_translations: TranslationName[];
  } | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** English is the source language, so it is the panel's label (as in catalogue.ts). */
function englishName(translations: TranslationName[] | undefined, fallback: string): string {
  return translations?.find((t) => t.locale === "en")?.name ?? fallback;
}

function toSummary(row: SummaryRow): PartnerSummary {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    displayName: row.display_name,
    areaLabel: row.area_label,
    status: row.status,
    contactName: row.contact_name,
    whatsapp: row.whatsapp,
    hasLocation: row.lat !== null,
    radiusKm: row.radius,
    closedUntil: row.closed_until,
    selfDelivery: row.self_delivery,
    offerCount: row.partner_offers?.[0]?.count ?? 0,
  };
}

/** The order a list is read in: the house, then whoever is taking orders. */
const STATUS_RANK: Record<PartnerStatus, number> = { active: 0, onboarding: 1, paused: 2, ended: 3 };

function byListOrder(a: PartnerSummary, b: PartnerSummary): number {
  if (a.kind !== b.kind) return a.kind === "house" ? -1 : 1;
  if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  return a.displayName.localeCompare(b.displayName);
}

/** True while `closed_until` is still ahead. */
export function isClosedNow(closedUntil: string | null): boolean {
  return closedUntil !== null && new Date(closedUntil).getTime() > Date.now();
}

// ----------------------------------------------------------------- reads --

export async function listPartners(options: {
  status?: PartnerStatus | "all";
  search?: string;
} = {}): Promise<PartnerSummary[]> {
  const supabase = await createClient();

  let query = supabase.from("partners").select(SUMMARY_COLUMNS).limit(500);
  if (options.status && options.status !== "all") query = query.eq("status", options.status);

  // Offers are counted from their own rows rather than with an embedded
  // `count`, which depends on PostgREST's aggregate setting. A few thousand
  // short rows at the very most.
  const [{ data, error }, { data: offerRows, error: offerError }] = await Promise.all([
    query,
    supabase.from("partner_offers").select("partner_id").limit(20000),
  ]);
  if (error) throw new Error(`listPartners: ${error.message}`);
  if (offerError) throw new Error(`listPartners (offers): ${offerError.message}`);

  const counts = new Map<string, number>();
  for (const o of (offerRows ?? []) as { partner_id: string }[]) {
    counts.set(o.partner_id, (counts.get(o.partner_id) ?? 0) + 1);
  }

  let rows = ((data ?? []) as unknown as Omit<SummaryRow, "partner_offers">[]).map((r) =>
    toSummary({ ...r, partner_offers: [{ count: counts.get(r.id) ?? 0 }] }),
  );

  // A few dozen nurseries at most for a long while; filtering here keeps the
  // search across every name a person might type without a second query.
  const search = options.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter((p) =>
      [p.displayName, p.name, p.areaLabel, p.contactName, p.whatsapp ?? ""].some((s) =>
        s.toLowerCase().includes(search),
      ),
    );
  }

  return rows.sort(byListOrder);
}

export async function getPartner(slug: string): Promise<PartnerDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partners")
    .select(`
      ${SUMMARY_COLUMNS}, lng, address, pickup_hours, priority, preferred_locale,
      agreement_signed_on, notes, created_at, updated_at,
      partner_offers (
        variant_id, net_price_sen, availability, updated_at,
        product_variants ( id, sku, size_key, price_sen, position, products ( ref, is_active, product_translations ( locale, name ) ) )
      )
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getPartner: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as Omit<SummaryRow, "partner_offers"> & {
    lng: number | null;
    address: string;
    pickup_hours: PickupHours;
    priority: number;
    preferred_locale: LocaleCode;
    agreement_signed_on: string | null;
    notes: string;
    created_at: string;
    updated_at: string;
    partner_offers: {
      variant_id: string;
      net_price_sen: number;
      availability: OfferAvailability;
      updated_at: string;
      product_variants: VariantEmbed | VariantEmbed[] | null;
    }[];
  };

  const offers: (PartnerOfferRow & { position: number })[] = row.partner_offers.flatMap((o) => {
    const v = one(o.product_variants);
    if (!v) return [];
    const product = one(v.products);
    return [
      {
        variantId: o.variant_id,
        sku: v.sku,
        sizeKey: v.size_key,
        productRef: product?.ref ?? "",
        productName: englishName(product?.product_translations, v.sku),
        productActive: product?.is_active ?? false,
        priceSen: v.price_sen,
        netPriceSen: o.net_price_sen,
        availability: o.availability,
        updatedAt: o.updated_at,
        position: v.position,
      },
    ];
  });

  offers.sort((a, b) => a.productName.localeCompare(b.productName) || a.position - b.position);

  return {
    ...toSummary({ ...row, partner_offers: [{ count: offers.length }] }),
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    pickupHours: row.pickup_hours ?? {},
    priority: row.priority,
    preferredLocale: row.preferred_locale,
    agreementSignedOn: row.agreement_signed_on,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    offers: offers.map(({ position, ...rest }) => (void position, rest)),
  };
}

/** The owner's view of where a nursery is paid. `null` for anyone else, by RLS. */
export async function getPayoutAccount(partnerId: string): Promise<PayoutAccount | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_payout_accounts")
    .select("bank_name, account_name, account_no, updated_at")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!data) return null;
  const row = data as { bank_name: string; account_name: string; account_no: string; updated_at: string };
  return {
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNo: row.account_no,
    updatedAt: row.updated_at,
  };
}

/** Every nursery's offer on these variants — the product screen's "who stocks this". */
export async function listOffersForVariants(variantIds: string[]): Promise<ProductOfferRow[]> {
  if (variantIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partner_offers")
    .select("variant_id, net_price_sen, availability, partners ( id, slug, display_name, area_label, status )")
    .in("variant_id", variantIds);

  if (error) throw new Error(`listOffersForVariants: ${error.message}`);

  type Row = {
    variant_id: string;
    net_price_sen: number;
    availability: OfferAvailability;
    partners:
      | { id: string; slug: string; display_name: string; area_label: string; status: PartnerStatus }
      | { id: string; slug: string; display_name: string; area_label: string; status: PartnerStatus }[]
      | null;
  };

  return ((data ?? []) as unknown as Row[])
    .flatMap((r) => {
      const p = one(r.partners);
      if (!p) return [];
      return [
        {
          variantId: r.variant_id,
          partnerId: p.id,
          partnerSlug: p.slug,
          partnerName: p.display_name,
          partnerArea: p.area_label,
          partnerStatus: p.status,
          netPriceSen: r.net_price_sen,
          availability: r.availability,
        },
      ];
    })
    .sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}

/** Nurseries an offer can be added for. Ended partners are not offered. */
export async function listNurseryOptions(): Promise<NurseryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("id, slug, display_name, area_label, status")
    .eq("kind", "nursery")
    .neq("status", "ended")
    .order("display_name");

  if (error) throw new Error(`listNurseryOptions: ${error.message}`);

  return ((data ?? []) as { id: string; slug: string; display_name: string; area_label: string; status: PartnerStatus }[]).map(
    (r) => ({ id: r.id, slug: r.slug, displayName: r.display_name, areaLabel: r.area_label, status: r.status }),
  );
}

/** Every variant in the catalogue, for "add a plant this nursery stocks". */
export async function listVariantOptions(): Promise<VariantOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, sku, size_key, price_sen, position, products ( ref, is_active, product_translations ( locale, name ) )")
    .limit(2000);

  if (error) throw new Error(`listVariantOptions: ${error.message}`);

  return ((data ?? []) as unknown as VariantEmbed[])
    .map((v) => {
      const product = one(v.products);
      return {
        id: v.id,
        sku: v.sku,
        sizeKey: v.size_key,
        priceSen: v.price_sen,
        productRef: product?.ref ?? "",
        productName: englishName(product?.product_translations, v.sku),
        productActive: product?.is_active ?? false,
        position: v.position,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName) || a.position - b.position)
    .map(({ position, ...rest }) => (void position, rest));
}
