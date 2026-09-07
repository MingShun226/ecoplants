/**
 * The states this shop delivers to, and how to recognise one by any of the
 * names it goes by.
 *
 * Client-safe: the checkout form renders the list and the address lookup maps
 * Google's answer onto it, and those two must agree or a shopper picks their
 * own street and lands on a form that says the state is invalid.
 *
 * EcoPlants covers Peninsular Malaysia only, so Sabah, Sarawak and Labuan are
 * absent rather than offered and then refused. `place_order()` rejects them at
 * the database too, so a hand-built request gets the same answer as the form.
 */
export const PENINSULAR_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Putrajaya",
] as const;

export type PeninsularState = (typeof PENINSULAR_STATES)[number];

/**
 * Everything a state gets called, lowercased, mapped to the one name the form
 * uses.
 *
 * Google returns the full official name — "Wilayah Persekutuan Kuala Lumpur"
 * for KL, "Pulau Pinang" or "Penang" depending on the place — and none of them
 * match a `<Select>` option by string equality. Malay and English forms are
 * both here because both come back, and the postal abbreviations because a
 * shopper typing their own address uses them.
 */
const ALIASES: Record<string, PeninsularState> = {
  "johor": "Johor",
  "johor darul ta'zim": "Johor",
  "johore": "Johor",
  "kedah": "Kedah",
  "kedah darul aman": "Kedah",
  "kelantan": "Kelantan",
  "kelantan darul naim": "Kelantan",
  "melaka": "Melaka",
  "malacca": "Melaka",
  "negeri sembilan": "Negeri Sembilan",
  "negeri sembilan darul khusus": "Negeri Sembilan",
  "pahang": "Pahang",
  "pahang darul makmur": "Pahang",
  "perak": "Perak",
  "perak darul ridzuan": "Perak",
  "perlis": "Perlis",
  "perlis indera kayangan": "Perlis",
  "pulau pinang": "Pulau Pinang",
  "penang": "Pulau Pinang",
  "selangor": "Selangor",
  "selangor darul ehsan": "Selangor",
  "terengganu": "Terengganu",
  "terengganu darul iman": "Terengganu",
  "kuala lumpur": "Kuala Lumpur",
  "wilayah persekutuan kuala lumpur": "Kuala Lumpur",
  "federal territory of kuala lumpur": "Kuala Lumpur",
  "putrajaya": "Putrajaya",
  "wilayah persekutuan putrajaya": "Putrajaya",
  "federal territory of putrajaya": "Putrajaya",
};

/**
 * The form's name for a state, or null.
 *
 * Null covers two different things on purpose: a name we do not recognise, and
 * Sabah, Sarawak or Labuan — which we recognise perfectly well and do not
 * deliver to. Both leave the picker empty so the shopper chooses, and the one
 * that matters is caught by the picker having no such option.
 */
export function toPeninsularState(name: string | null | undefined): PeninsularState | null {
  if (!name) return null;
  return ALIASES[name.trim().toLowerCase()] ?? null;
}
