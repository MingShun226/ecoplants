/**
 * The shape of an AI-drafted plant, and the rules that make a model's answer
 * safe to put in front of an operator.
 *
 * Client-safe by construction — no Supabase import, no `server-only`, nothing
 * that reads a key. The card and the forms it fills are all client components,
 * and a value import from a server module would drag the OpenAI call into the
 * browser bundle. The network half lives in `ai-assist-actions.ts`; this file
 * is the half both sides may hold.
 *
 * Everything here is a pure function of the model's reply, which is what makes
 * the safety rules testable without spending a request.
 */

import {
  DIFFICULTIES,
  LIGHT_LEVELS,
  LOCALES,
  PLACEMENTS,
  WATER_FREQUENCIES,
  type CareDifficulty,
  type LightLevel,
  type LocaleCode,
  type PlantPlacement,
  type WaterFrequency,
} from "@/lib/admin/enums";

/** The default model. Overridden per-deployment by `OPENAI_MODEL`. */
export const DEFAULT_MODEL = "gpt-5.6-terra";

/** One locale's worth of drafted copy. Mirrors the translation form's fields. */
export interface DraftCopy {
  name: string;
  tagline: string;
  description: string;
  careSummary: string;
  climateNote: string;
  toxicityNote: string;
}

export interface DraftAttributes {
  light: LightLevel | null;
  water: WaterFrequency | null;
  difficulty: CareDifficulty | null;
  placement: PlantPlacement | null;
  matureHeightCm: number | null;
  airPurifying: boolean;
  /**
   * Never `true`.
   *
   * The storefront reads `true` as "safe around a cat", and a model that had
   * misidentified a Dieffenbachia as a Dracaena would be saying exactly that,
   * fluently. `false` (toxic) and `null` (nobody has checked) are both
   * survivable when wrong; `true` is not. So the type does not permit it, and
   * `normaliseDraft` folds any claim of safety down to `null`.
   */
  petSafe: false | null;
}

export interface PlantDraft {
  /** What the model believes the plant is, botanically. */
  identifiedAs: string;
  /** Whether it is sure enough of the species that the copy is worth reading. */
  confident: boolean;
  /** Why it is unsure, or anything else the operator should know first. */
  notes: string;
  copy: Record<LocaleCode, DraftCopy>;
  attributes: DraftAttributes;
}

// ------------------------------------------------------------ normalising --

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A model value is accepted only if it is one the database already knows. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function copyOf(value: unknown): DraftCopy {
  const o = (value ?? {}) as Record<string, unknown>;
  return {
    name: str(o.name),
    tagline: str(o.tagline),
    description: str(o.description),
    careSummary: str(o.careSummary),
    climateNote: str(o.climateNote),
    toxicityNote: str(o.toxicityNote),
  };
}

/**
 * Turn whatever the model returned into a draft, or `null` if it is unusable.
 *
 * Structured outputs make the shape very likely but not certain — a refusal, a
 * truncated response and a schema drift all arrive here as the wrong thing, and
 * every one of them must produce `null` rather than a half-draft that blanks an
 * operator's existing fields with empty strings.
 */
export function normaliseDraft(raw: unknown): PlantDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const copyIn = (o.copy ?? {}) as Record<string, unknown>;
  const copy = {} as Record<LocaleCode, DraftCopy>;
  for (const locale of LOCALES) copy[locale] = copyOf(copyIn[locale]);

  // English is the source the other two fall back to. With no name there, there
  // is nothing worth showing, whatever else came back.
  if (!copy.en.name) return null;

  const a = (o.attributes ?? {}) as Record<string, unknown>;

  const height = Number(a.matureHeightCm);
  const matureHeightCm =
    Number.isFinite(height) && height > 0 && height < 10_000 ? Math.round(height) : null;

  return {
    identifiedAs: str(o.identifiedAs),
    confident: o.confident === true,
    notes: str(o.notes),
    copy,
    attributes: {
      light: oneOf(a.light, LIGHT_LEVELS),
      water: oneOf(a.water, WATER_FREQUENCIES),
      difficulty: oneOf(a.difficulty, DIFFICULTIES),
      placement: oneOf(a.placement, PLACEMENTS),
      matureHeightCm,
      airPurifying: a.airPurifying === true,
      // The one asymmetric rule on this screen. "toxic" is taken at its word;
      // everything else — "safe", "unknown", a missing key, a typo — becomes
      // "not verified", which the storefront never renders as safe.
      petSafe: a.petSafe === "toxic" ? false : null,
    },
  };
}

// ---------------------------------------------------------------- request --

/**
 * The JSON schema the model must answer in.
 *
 * `strict` mode requires every property to appear in `required` and
 * `additionalProperties: false` at every level, so a field with nothing to say
 * comes back as an empty string rather than as an omission.
 */
const COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "tagline", "description", "careSummary", "climateNote", "toxicityNote"],
  properties: {
    name: { type: "string", description: "The plant's common retail name in this language." },
    tagline: { type: "string", description: "One short line, under 60 characters." },
    description: {
      type: "string",
      description:
        "Two short paragraphs. What it looks like, where it suits, why someone buys it.",
    },
    careSummary: {
      type: "string",
      description:
        "140-155 characters. This is the Google search snippet, so it must read as a complete sentence and name the plant.",
    },
    climateNote: {
      type: "string",
      description:
        "Malaysian conditions only — humidity, monsoon rain, air-conditioned rooms. Never USDA or European hardiness zones.",
    },
    toxicityNote: {
      type: "string",
      description:
        "What happens if a pet or child eats it. Empty string if genuinely unknown — never a reassurance.",
    },
  },
} as const;

export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["identifiedAs", "confident", "notes", "copy", "attributes"],
  properties: {
    identifiedAs: {
      type: "string",
      description: "The botanical name you believe this is, e.g. Aglaonema commutatum.",
    },
    confident: {
      type: "boolean",
      description:
        "True only if you are sure of the species. False if the photo is unclear, or if several species look like this.",
    },
    notes: {
      type: "string",
      description: "Why you are unsure, or anything the shop owner should check. Empty if none.",
    },
    copy: {
      type: "object",
      additionalProperties: false,
      required: ["en", "ms", "zh"],
      properties: { en: COPY_SCHEMA, ms: COPY_SCHEMA, zh: COPY_SCHEMA },
    },
    attributes: {
      type: "object",
      additionalProperties: false,
      required: [
        "light",
        "water",
        "difficulty",
        "placement",
        "matureHeightCm",
        "airPurifying",
        "petSafe",
      ],
      properties: {
        light: { type: ["string", "null"], enum: [...LIGHT_LEVELS, null] },
        water: { type: ["string", "null"], enum: [...WATER_FREQUENCIES, null] },
        difficulty: { type: ["string", "null"], enum: [...DIFFICULTIES, null] },
        placement: { type: ["string", "null"], enum: [...PLACEMENTS, null] },
        matureHeightCm: {
          type: ["number", "null"],
          description: "Typical mature height in centimetres, or null if it varies too widely.",
        },
        airPurifying: { type: "boolean" },
        petSafe: {
          type: "string",
          enum: ["toxic", "unknown"],
          description:
            "'toxic' if any part harms a cat, dog or child. 'unknown' otherwise. There is deliberately no 'safe' option — a person verifies that.",
        },
      },
    },
  },
} as const;

/**
 * The instructions.
 *
 * Kept beside the schema because the two are one artefact: a field's meaning is
 * half its schema description and half this.
 */
export function buildPrompt(input: { name: string; botanical: string; hasPhoto: boolean }): string {
  return [
    "You are writing catalogue copy for EcoPlants, a plant nursery in Malaysia.",
    "",
    input.hasPhoto
      ? `The photograph is of a plant the shop lists as "${input.name}".`
      : `There is no photograph. The shop lists this plant as "${input.name}".`,
    input.botanical && input.botanical !== input.name
      ? `They record its botanical name as "${input.botanical}".`
      : "",
    "",
    "Identify the plant, then write its listing in English, Bahasa Melayu and Chinese.",
    "",
    "Rules:",
    "- Write each language natively. Do not translate the English word by word — a Malay shopper and a Chinese shopper search for different things, so use the terms each actually types.",
    "- Chinese copy uses Simplified characters, as used in Malaysia.",
    "- The care summary is the Google search snippet. 140-155 characters, a complete sentence, and it must contain the plant's name.",
    "- Write for Malaysia: year-round heat, high humidity, monsoon rain, and air-conditioned rooms that dry a plant out. Never mention frost, winter or hardiness zones.",
    "- Say what is true of the plant, not what would sell it. No invented awards, origins or health claims.",
    input.hasPhoto
      ? "- If the photograph does not show the plant clearly enough to be sure of the species, set confident to false and say why in notes. Still fill everything in — a person reviews it before it is saved."
      : "- You are working from the name alone, so set confident to false unless that name identifies exactly one species.",
    "- On pet safety you may answer only 'toxic' or 'unknown'. If any part of the plant harms a cat, dog or child, answer 'toxic' and describe it in the toxicity note. Otherwise answer 'unknown' — a person verifies safety here, never you.",
  ]
    .filter(Boolean)
    .join("\n");
}
