"use server";

import { toPeninsularState, type PeninsularState } from "@/lib/checkout/states";

/**
 * Address lookup, through our own server.
 *
 * The key stays here. Google's own autocomplete widget runs in the browser and
 * needs a key shipped to every visitor, which then has to be fenced in by HTTP
 * referrer — a restriction that stops nobody who can copy a header. Asking
 * Google from the server keeps the key on the server, and it means the field
 * below is our own component in the shop's own type rather than an iframe that
 * ignores the design system.
 *
 * Both calls carry the same `sessionToken`. Google bills a run of keystrokes
 * plus the one detail fetch as a single session when they share a token, and as
 * separate requests when they do not.
 */

const AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS = "https://places.googleapis.com/v1/places";

export interface AddressSuggestion {
  placeId: string;
  /** The street or building, bolded in the list. */
  main: string;
  /** Everything after it — town, state, country. */
  secondary: string;
}

export interface ResolvedAddress {
  line1: string;
  city: string;
  postcode: string;
  state: PeninsularState | null;
}

/** Reads a component out of Google's list by type. */
function part(
  components: { types?: string[]; longText?: string; shortText?: string }[],
  type: string,
): string {
  return components.find((c) => c.types?.includes(type))?.longText ?? "";
}

export async function suggestAddresses(
  input: string,
  sessionToken: string,
): Promise<AddressSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  // Not configured is not an error a shopper should see. The field falls back
  // to being an ordinary text input, which is what it was before this existed.
  if (!key || input.trim().length < 3) return [];

  try {
    const response = await fetch(AUTOCOMPLETE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input,
        // Malaysia only. The shop delivers to one country, and offering a
        // shopper a street in Jakarta wastes a request and their time.
        includedRegionCodes: ["MY"],
        sessionToken,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const body = (await response.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        };
      }[];
    };

    return (body.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        placeId: p.placeId as string,
        main: p.structuredFormat?.mainText?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .slice(0, 5);
  } catch {
    // A timeout or a network blip leaves the shopper typing their address by
    // hand, which is exactly what they would have done anyway.
    return [];
  }
}

export async function resolveAddress(
  placeId: string,
  sessionToken: string,
): Promise<ResolvedAddress | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const response = await fetch(
      `${DETAILS}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          // Billed per field group, so this asks for the address and nothing
          // else — no photos, no opening hours, no reviews.
          "X-Goog-FieldMask": "addressComponents",
        },
        signal: AbortSignal.timeout(6000),
      },
    );

    if (!response.ok) return null;

    const body = (await response.json()) as {
      addressComponents?: { types?: string[]; longText?: string; shortText?: string }[];
    };
    const components = body.addressComponents ?? [];

    // Malaysian addresses come back with the building or house number separate
    // from the street, and a shopper writes them as one line.
    const number = part(components, "street_number");
    const route = part(components, "route");
    const premise = part(components, "premise") || part(components, "subpremise");

    const line1 = [premise, [number, route].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ")
      .trim();

    // Google files Malaysian towns under `locality` most of the time and under
    // the postal town otherwise; neither is reliable alone.
    const city =
      part(components, "locality") ||
      part(components, "postal_town") ||
      part(components, "administrative_area_level_2");

    return {
      line1,
      city,
      postcode: part(components, "postal_code"),
      state: toPeninsularState(part(components, "administrative_area_level_1")),
    };
  } catch {
    return null;
  }
}
