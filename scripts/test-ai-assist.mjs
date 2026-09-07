/**
 * The rules that stand between a model's confident guess and a poisoned cat.
 *
 * `normaliseDraft` is the only thing between the OpenAI response and the fields
 * an operator sees, so these cover the cases where a wrong answer costs
 * something: a claim of pet safety, a value the database has no room for, and a
 * reply mangled badly enough that filling the form would blank real copy.
 *
 * Run with `npm test`. No network, no key, no build.
 */
import { register } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";

register("./ts-alias-hook.mjs", import.meta.url);

const { normaliseDraft } = await import("../lib/admin/ai-assist.ts");

/** A well-formed reply, which each test then spoils in one specific way. */
function reply(overrides = {}) {
  const copy = {
    name: "Aglaonema Red",
    tagline: "Colour without a window",
    description: "Two paragraphs.",
    careSummary: "A summary.",
    climateNote: "Likes our humidity.",
    toxicityNote: "",
  };
  return {
    identifiedAs: "Aglaonema commutatum",
    confident: true,
    notes: "",
    copy: { en: copy, ms: copy, zh: copy },
    attributes: {
      light: "bright-indirect",
      water: "when-dry",
      difficulty: "easy",
      placement: "indoor",
      matureHeightCm: 60,
      airPurifying: true,
      petSafe: "unknown",
    },
    ...overrides,
  };
}

function withAttributes(patch) {
  const base = reply();
  return { ...base, attributes: { ...base.attributes, ...patch } };
}

// ------------------------------------------------------------ pet safety --

test("a model claiming the plant is safe is not believed", () => {
  // The schema offers no "safe" value, so this can only arrive from a model
  // ignoring it — which is exactly when the rule has to hold.
  const draft = normaliseDraft(withAttributes({ petSafe: "safe" }));
  assert.equal(draft.attributes.petSafe, null);
});

test("every unexpected pet-safety value lands on not-verified", () => {
  for (const value of ["SAFE", "yes", "true", true, 1, "", null, undefined]) {
    const draft = normaliseDraft(withAttributes({ petSafe: value }));
    assert.equal(draft.attributes.petSafe, null, `petSafe: ${JSON.stringify(value)}`);
  }
});

test("toxic is taken at its word", () => {
  const draft = normaliseDraft(withAttributes({ petSafe: "toxic" }));
  assert.equal(draft.attributes.petSafe, false);
});

// ------------------------------------------------------- database vocabulary --

test("care values the database does not define are dropped", () => {
  const draft = normaliseDraft(
    withAttributes({
      light: "partial-shade",
      water: "twice a week",
      difficulty: "medium",
      placement: "balcony",
    }),
  );

  assert.equal(draft.attributes.light, null);
  assert.equal(draft.attributes.water, null);
  assert.equal(draft.attributes.difficulty, null);
  assert.equal(draft.attributes.placement, null);
});

test("known care values survive", () => {
  const draft = normaliseDraft(reply());
  assert.equal(draft.attributes.light, "bright-indirect");
  assert.equal(draft.attributes.water, "when-dry");
  assert.equal(draft.attributes.difficulty, "easy");
  assert.equal(draft.attributes.placement, "indoor");
});

test("an impossible height is dropped rather than stored", () => {
  for (const value of [0, -20, 99999, "tall", null, NaN]) {
    const draft = normaliseDraft(withAttributes({ matureHeightCm: value }));
    assert.equal(draft.attributes.matureHeightCm, null, `height: ${JSON.stringify(value)}`);
  }
});

test("a fractional height is rounded, not rejected", () => {
  const draft = normaliseDraft(withAttributes({ matureHeightCm: 59.6 }));
  assert.equal(draft.attributes.matureHeightCm, 60);
});

// ----------------------------------------------------------- unusable replies --

test("a reply with no English name fills nothing", () => {
  const base = reply();
  const spoiled = {
    ...base,
    copy: { ...base.copy, en: { ...base.copy.en, name: "   " } },
  };
  assert.equal(normaliseDraft(spoiled), null);
});

test("junk in place of a reply fills nothing", () => {
  for (const value of [null, undefined, "refused", 42, []]) {
    assert.equal(normaliseDraft(value), null, `reply: ${JSON.stringify(value)}`);
  }
});

test("a missing language becomes empty strings, not undefined", () => {
  const base = reply();
  const draft = normaliseDraft({ ...base, copy: { en: base.copy.en } });

  assert.equal(draft.copy.ms.name, "");
  assert.equal(draft.copy.zh.description, "");
});

// ------------------------------------------------------------- confidence --

test("confidence is only true when the model actually said so", () => {
  for (const value of ["true", 1, "yes", null, undefined]) {
    const draft = normaliseDraft({ ...reply(), confident: value });
    assert.equal(draft.confident, false, `confident: ${JSON.stringify(value)}`);
  }
  assert.equal(normaliseDraft(reply()).confident, true);
});

test("copy is trimmed", () => {
  const base = reply();
  const draft = normaliseDraft({
    ...base,
    copy: { ...base.copy, en: { ...base.copy.en, name: "  Aglaonema Red  " } },
  });
  assert.equal(draft.copy.en.name, "Aglaonema Red");
});
