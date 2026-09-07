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

const { normaliseDraft, applyDraftCopy, preferDraft } = await import("../lib/admin/ai-assist.ts");

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

// ------------------------------------------------- filling a locale's form --

/** What a translation form holds before anyone has drafted or typed. */
function emptyFields() {
  return {
    name: "",
    slug: "thuja",
    tagline: "",
    description: "",
    careSummary: "",
    climateNote: "",
    toxicityNote: "",
  };
}

test("every locale gets filled, not just the tab that was open", () => {
  // The bug this covers: the Malay and Chinese forms are mounted by a keyed
  // remount when their tab is first clicked, long after the draft arrived. A
  // draft applied only on arrival reached English and nothing else.
  const base = reply();
  const draft = normaliseDraft({
    ...base,
    copy: {
      en: { ...base.copy.en, name: "Lemon Cypress" },
      ms: { ...base.copy.en, name: "Cemara Lemon" },
      zh: { ...base.copy.en, name: "柠檬柏" },
    },
  });

  assert.equal(applyDraftCopy(emptyFields(), draft, "en").name, "Lemon Cypress");
  assert.equal(applyDraftCopy(emptyFields(), draft, "ms").name, "Cemara Lemon");
  assert.equal(applyDraftCopy(emptyFields(), draft, "zh").name, "柠檬柏");
});

test("switching back to a tab still shows the draft", () => {
  // A tab switch remounts the form from the saved copy, so the same call has to
  // produce the draft again from scratch — not only the first time.
  const draft = normaliseDraft(reply());
  const first = applyDraftCopy(emptyFields(), draft, "en");
  const afterSwitchingBack = applyDraftCopy(emptyFields(), draft, "en");

  assert.deepEqual(afterSwitchingBack, first);
  assert.notEqual(afterSwitchingBack.name, "");
});

test("with no draft the saved copy is returned untouched", () => {
  const fields = { ...emptyFields(), name: "Typed by hand" };
  assert.deepEqual(applyDraftCopy(fields, null, "en"), fields);
});

test("a drafted field never clears copy someone already wrote", () => {
  const base = reply();
  const draft = normaliseDraft({
    ...base,
    copy: { ...base.copy, en: { ...base.copy.en, toxicityNote: "   " } },
  });

  const fields = { ...emptyFields(), toxicityNote: "From the supplier sheet." };
  assert.equal(applyDraftCopy(fields, draft, "en").toxicityNote, "From the supplier sheet.");
});

test("the slug is never drafted", () => {
  const draft = normaliseDraft(reply());
  assert.equal(applyDraftCopy(emptyFields(), draft, "en").slug, "thuja");
});

test("preferDraft keeps what exists when the draft is blank", () => {
  assert.equal(preferDraft("", "kept"), "kept");
  assert.equal(preferDraft("   ", "kept"), "kept");
  assert.equal(preferDraft("drafted", "kept"), "drafted");
});

test("copy is trimmed", () => {
  const base = reply();
  const draft = normaliseDraft({
    ...base,
    copy: { ...base.copy, en: { ...base.copy.en, name: "  Aglaonema Red  " } },
  });
  assert.equal(draft.copy.en.name, "Aglaonema Red");
});
