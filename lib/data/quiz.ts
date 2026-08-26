import type { Product } from "@/types/catalog";
import { sizeBucket } from "./facets";

/**
 * Plant-finder quiz. Six questions, inside the ≤8 ceiling where completion
 * falls off sharply.
 *
 * Scoring is deliberately transparent and rule-based rather than a black box:
 * every recommendation can be explained back to the shopper ("pet-safe, copes
 * with low light"), which is the whole point of asking. Reasons and cautions
 * are returned as message keys so the explanation translates with the UI.
 *
 * The answers are also zero-party data — when Supabase is wired, this object is
 * what gets written to `quiz_responses` alongside the recommended ids.
 */

export interface QuizOption {
  value: string;
  /** Message keys in the `quiz` namespace. */
  labelKey: string;
  hintKey?: string;
}

export interface QuizQuestion {
  id: string;
  questionKey: string;
  helpKey?: string;
  options: QuizOption[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: "light",
    questionKey: "q1",
    helpKey: "q1Help",
    options: [
      { value: "low", labelKey: "q1Low", hintKey: "q1LowHint" },
      { value: "medium", labelKey: "q1Medium", hintKey: "q1MediumHint" },
      { value: "bright-indirect", labelKey: "q1Bright", hintKey: "q1BrightHint" },
      { value: "direct-sun", labelKey: "q1Sun", hintKey: "q1SunHint" },
    ],
  },
  {
    id: "watering",
    questionKey: "q2",
    helpKey: "q2Help",
    options: [
      { value: "rarely", labelKey: "q2Rarely", hintKey: "q2RarelyHint" },
      { value: "weekly", labelKey: "q2Weekly" },
      { value: "often", labelKey: "q2Often", hintKey: "q2OftenHint" },
    ],
  },
  {
    id: "pets",
    questionKey: "q3",
    options: [
      { value: "yes", labelKey: "q3Yes", hintKey: "q3YesHint" },
      { value: "no", labelKey: "q3No" },
    ],
  },
  {
    id: "experience",
    questionKey: "q4",
    options: [
      { value: "never", labelKey: "q4Never" },
      { value: "some", labelKey: "q4Some" },
      { value: "confident", labelKey: "q4Confident" },
    ],
  },
  {
    id: "size",
    questionKey: "q5",
    options: [
      { value: "desk", labelKey: "q5Desk", hintKey: "q5DeskHint" },
      { value: "floor", labelKey: "q5Floor", hintKey: "q5FloorHint" },
      { value: "statement", labelKey: "q5Statement", hintKey: "q5StatementHint" },
    ],
  },
  {
    id: "aircon",
    questionKey: "q6",
    helpKey: "q6Help",
    options: [
      { value: "yes", labelKey: "q6Yes" },
      { value: "sometimes", labelKey: "q6Sometimes" },
      { value: "no", labelKey: "q6No" },
    ],
  },
];

export type QuizAnswers = Record<string, string>;

export interface QuizMatch {
  product: Product;
  score: number;
  /** Message keys in the `quiz` namespace. */
  reasons: string[];
  /** Honest caveats — a recommendation nobody trusts is worth nothing. */
  cautions: string[];
}

/** Hard filters remove anything that would be actively wrong to recommend. */
function isEligible(product: Product, answers: QuizAnswers): boolean {
  if (answers.pets === "yes" && product.attributes.petSafe !== true) return false;

  // Full-sun plants die indoors; indoor-only plants scorch on a hot balcony.
  if (answers.light === "direct-sun" && product.attributes.placement === "indoor") return false;
  if (answers.light !== "direct-sun" && product.attributes.placement === "outdoor") return false;

  return true;
}

export function scoreQuiz(products: Product[], answers: QuizAnswers): QuizMatch[] {
  const matches = products
    .filter((p) => p.isActive && isEligible(p, answers))
    .map((product) => {
      const { attributes } = product;
      let score = 0;
      const reasons: string[] = [];
      const cautions: string[] = [];

      // Light — the single strongest predictor of whether a plant survives.
      if (attributes.light === answers.light) {
        score += 5;
        reasons.push("reasonLightExact");
      } else if (
        (answers.light === "medium" && attributes.light === "low") ||
        (answers.light === "bright-indirect" && attributes.light === "medium")
      ) {
        score += 3;
        reasons.push("reasonLightTolerant");
      } else if (answers.light === "low" && attributes.light !== "low") {
        score -= 4;
        cautions.push("cautionDim");
      }

      // Watering habit vs. what the plant needs.
      if (answers.watering === "rarely") {
        if (attributes.water === "when-dry") {
          score += 4;
          reasons.push("reasonForgotten");
        }
        if (attributes.water === "keep-moist") {
          score -= 5;
          cautions.push("cautionMoist");
        }
      }
      if (answers.watering === "weekly" && attributes.water === "weekly") {
        score += 4;
        reasons.push("reasonWeekly");
      }
      if (answers.watering === "often") {
        if (attributes.water === "keep-moist") {
          score += 4;
          reasons.push("reasonAttention");
        }
        if (attributes.water === "when-dry") {
          score -= 2;
          cautions.push("cautionOverwater");
        }
      }

      // Experience vs. difficulty.
      const level = { beginner: 1, easy: 2, moderate: 3, expert: 4 }[attributes.difficulty];
      const tolerance = { never: 1, some: 2, confident: 4 }[answers.experience] ?? 2;
      if (level <= tolerance) {
        score += 3;
        if (answers.experience === "never" && level === 1) reasons.push("reasonHardToKill");
      } else {
        score -= (level - tolerance) * 3;
        cautions.push("cautionDemanding");
      }

      // Size.
      const bucket = sizeBucket(attributes.matureHeightCm);
      if (bucket === answers.size) {
        score += 3;
        reasons.push("reasonSize");
      } else if (
        (answers.size === "desk" && bucket === "floor") ||
        (answers.size === "statement" && bucket === "floor")
      ) {
        score += 1;
      } else {
        score -= 2;
      }

      // Aircon strips the humidity that moisture-lovers depend on.
      if (answers.aircon === "yes") {
        if (attributes.water === "keep-moist") {
          score -= 3;
          cautions.push("cautionAircon");
        } else {
          score += 2;
          reasons.push("reasonAircon");
        }
      }

      if (answers.pets === "yes" && attributes.petSafe === true) {
        reasons.push("reasonPetSafe");
      }

      return { product, score, reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 2) };
    });

  return matches.sort((a, b) => b.score - a.score || b.product.rating - a.product.rating);
}

/** Plants the answers rule out, so the shopper learns what to avoid too. */
export function avoidList(products: Product[], answers: QuizAnswers): Product[] {
  if (answers.pets !== "yes") return [];
  return products.filter((p) => p.attributes.petSafe === false).slice(0, 3);
}
