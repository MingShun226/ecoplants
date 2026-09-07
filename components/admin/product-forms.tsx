"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteProduct,
  setProductActive,
  updateAttributes,
  updateProductFacts,
  updateTranslation,
} from "@/lib/admin/catalogue-actions";
import type { PlantAttributes, ProductDetail } from "@/lib/admin/catalogue";
import type { LocaleCode } from "@/lib/admin/enums";
import {
  BADGE_KEYS,
  DIFFICULTIES,
  LIGHT_LEVELS,
  LOCALE_LABEL,
  LOCALES,
  PLACEMENTS,
  WATER_FREQUENCIES,
} from "@/lib/admin/enums";
import { useAiDraft } from "@/components/admin/ai-assist";
import { applyDraftCopy } from "@/lib/admin/ai-assist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The product editor.
 *
 * Every form saves on its own. A single "save everything" button across
 * translations, prices and attributes would make one typo in a slug throw away
 * an hour of copy-editing in another tab.
 */

/**
 * Radix's Select reserves the empty string to mean "nothing selected", so an
 * option that *is* "nothing" needs a value of its own. These never reach the
 * database — they are mapped back to "" and null at the boundary.
 */
const NO_CATEGORY = "__none__";
const NOT_SET = "__unset__";

/** Shared save-state plumbing, so each form is just its fields. */
function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  };

  return { pending, error, saved, run };
}

function SaveRow({
  pending,
  saved,
  error,
  dirty,
  label = "Save",
}: {
  pending: boolean;
  saved: boolean;
  error: string | null;
  dirty: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" disabled={pending || !dirty}>
        {pending ? "Saving…" : saved ? "Saved" : label}
      </Button>
      {saved && !pending ? (
        <span className="flex items-center gap-1 text-[12px] text-success">
          <Check className="size-3.5" aria-hidden="true" />
          Live on the storefront
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- visibility --

export function VisibilityToggle({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const { pending, run } = useSave();

  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "default"}
      disabled={pending}
      onClick={() => run(() => setProductActive(productId, !isActive))}
      className="gap-2"
    >
      {isActive ? (
        <>
          <EyeOff className="size-3.5" aria-hidden="true" />
          {pending ? "Hiding…" : "Hide from shop"}
        </>
      ) : (
        <>
          <Eye className="size-3.5" aria-hidden="true" />
          {pending ? "Publishing…" : "Publish to shop"}
        </>
      )}
    </Button>
  );
}

// ------------------------------------------------------------------ facts --

export function ProductFactsForm({
  product,
  categories,
}: {
  product: ProductDetail;
  categories: { id: string; name: string; isDerived: boolean }[];
}) {
  const { pending, error, saved, run } = useSave();
  const [botanical, setBotanical] = useState(product.nameBotanical ?? "");
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [badges, setBadges] = useState<string[]>(product.badges);

  const dirty =
    botanical !== (product.nameBotanical ?? "") ||
    categoryId !== (product.categoryId ?? "") ||
    badges.join("|") !== product.badges.join("|");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateProductFacts(product.id, {
            nameBotanical: botanical,
            categoryId: categoryId || null,
            badges,
          }),
        );
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="botanical">Botanical name</Label>
          <Input
            id="botanical"
            value={botanical}
            onChange={(e) => setBotanical(e.target.value)}
            placeholder="Monstera deliciosa"
            className="h-8 rounded-sm text-[13px] italic"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Category</Label>
          {/* The project's own Select, not a native one. A bare <select> is
              painted by the operating system, so it ignores every token in the
              design system and looks like a different application. */}
          <Select
            value={categoryId || NO_CATEGORY}
            onValueChange={(v) => setCategoryId(v === NO_CATEGORY ? "" : v)}
          >
            <SelectTrigger id="category" className="h-8 rounded-sm text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>No category</SelectItem>
              {categories
                .filter((c) => !c.isDerived)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Badges</Label>
        <div className="flex flex-wrap gap-1.5">
          {BADGE_KEYS.map((key) => {
            const on = badges.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setBadges(on ? badges.filter((b) => b !== key) : [...badges, key])}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                  on
                    ? "border-ink-950 bg-ink-950 text-ink-50"
                    : "border-border-default text-text-secondary hover:border-border-strong",
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          These are message keys, not copy. Each one is translated in{" "}
          <code className="text-text-secondary">messages/*.json</code> — a key with no
          translation renders as the raw key on the storefront.
        </p>
      </div>

      <SaveRow pending={pending} saved={saved} error={error} dirty={dirty} />
    </form>
  );
}

// ----------------------------------------------------------- translations --

/** One language's copy, in the shape the form edits and the action saves. */
type Copy = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  careSummary: string;
  climateNote: string;
  toxicityNote: string;
};

/**
 * All three languages, one Save.
 *
 * The tabs used to remount the form by key, which meant switching from Chinese
 * to Malay threw the Chinese edits away — silently, with no warning, and after
 * the work was done. That is the worst shape a data-loss bug can take.
 *
 * So the drafts for all three live here and the tabs only change which one is
 * on screen. Nothing is lost by switching, the button saves every language that
 * changed, and a tab carrying unsaved work says so on its own chip. It is also
 * how the job is actually done: someone writing a listing writes it three times
 * in a row, not once and then again next week.
 */
export function TranslationEditor({ product }: { product: ProductDetail }) {
  const [locale, setLocale] = useState<LocaleCode>("en");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  /** What the database holds, per language, as the form's field shape. */
  const saved = useMemo(() => {
    const out = {} as Record<LocaleCode, Copy>;
    for (const l of LOCALES) {
      const row = product.translations.find((t) => t.locale === l);
      out[l] = {
        name: row?.name ?? "",
        slug: row?.slug ?? "",
        tagline: row?.tagline ?? "",
        description: row?.description ?? "",
        careSummary: row?.careSummary ?? "",
        climateNote: row?.climateNote ?? "",
        toxicityNote: row?.toxicityNote ?? "",
      };
    }
    return out;
  }, [product.translations]);

  /**
   * AI Assist writes into the same fields a person types into, and leaves them
   * unsaved — so a draft is indistinguishable from typing, which is the point.
   * It reaches all three languages at once now, because all three exist.
   */
  const { draft, appliedAt } = useAiDraft();

  const [drafts, setDrafts] = useState(() => {
    const out = {} as Record<LocaleCode, Copy>;
    for (const l of LOCALES) out[l] = applyDraftCopy(saved[l], draft, l);
    return out;
  });

  // Adjusted during render rather than in an effect, so the fields never paint
  // their old values first.
  const [seenDraft, setSeenDraft] = useState(appliedAt);
  if (appliedAt !== seenDraft) {
    setSeenDraft(appliedAt);
    if (draft) {
      setDrafts((prev) => {
        const out = { ...prev };
        for (const l of LOCALES) out[l] = applyDraftCopy(prev[l], draft, l);
        return out;
      });
    }
  }

  const changedIn = (l: LocaleCode) => JSON.stringify(drafts[l]) !== JSON.stringify(saved[l]);
  const changed = LOCALES.filter(changedIn);

  const set = (key: keyof Copy) => (value: string) =>
    setDrafts((prev) => ({ ...prev, [locale]: { ...prev[locale], [key]: value } }));

  const f = drafts[locale];
  const isNew = !product.translations.some((t) => t.locale === locale);

  const save = () => {
    setError(null);
    start(async () => {
      // One at a time, and stop at the first refusal. A slug collision in Malay
      // should not leave the Chinese copy unsaved without saying which failed.
      for (const l of changed) {
        const result = await updateTranslation(product.id, l, drafts[l]);
        if (!result.ok) {
          setError(`${LOCALE_LABEL[l]}: ${result.error}`);
          return;
        }
      }
      setJustSaved(true);
      // Refreshing re-reads `product.translations`, which recomputes `saved`
      // and clears every unsaved marker without touching the drafts.
      router.refresh();
      window.setTimeout(() => setJustSaved(false), 2000);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap gap-1.5">
        {LOCALES.map((l) => {
          const missing = !product.translations.some((t) => t.locale === l);
          const unsaved = changedIn(l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] transition-colors",
                l === locale
                  ? "border-ink-950 bg-ink-950 text-ink-50"
                  : "border-border-default text-text-secondary hover:border-border-strong",
              )}
            >
              {LOCALE_LABEL[l]}
              {/* Two different dots. Amber says this language has no copy at
                  all; clay says it has edits nobody has saved — the one that
                  matters when you are about to leave the page. */}
              {unsaved ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    l === locale ? "bg-ink-50" : "bg-clay-600",
                  )}
                  aria-label="unsaved changes"
                />
              ) : missing ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    l === locale ? "bg-ink-50/60" : "bg-warning",
                  )}
                  aria-label="missing"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {isNew ? (
        <p className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] leading-relaxed">
          No {LOCALE_LABEL[locale]} copy exists yet. The storefront currently falls back
          to English for this product.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`name-${locale}`}>Name</Label>
          <Input
            id={`name-${locale}`}
            value={f.name}
            onChange={(e) => set("name")(e.target.value)}
            required
            className="h-8 rounded-sm text-[13px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`slug-${locale}`}>URL slug</Label>
          <Input
            id={`slug-${locale}`}
            value={f.slug}
            onChange={(e) => set("slug")(e.target.value)}
            required
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] text-text-tertiary">
            /{locale}/plants/<span className="text-text-secondary">{f.slug || "…"}</span>
          </p>
        </div>
      </div>

      <Field
        label="Tagline"
        id={`tagline-${locale}`}
        value={f.tagline}
        onChange={(e) => set("tagline")(e.target.value)}
      />
      <Field
        label="Description"
        id={`desc-${locale}`}
        value={f.description}
        onChange={(e) => set("description")(e.target.value)}
        rows={4}
      />
      <Field
        label="Care summary"
        id={`care-${locale}`}
        value={f.careSummary}
        onChange={(e) => set("careSummary")(e.target.value)}
        rows={2}
      />
      <Field
        label="Climate note"
        id={`climate-${locale}`}
        value={f.climateNote}
        onChange={(e) => set("climateNote")(e.target.value)}
        rows={2}
        hint="Malaysian conditions specifically — humidity, monsoon, indoor aircon."
      />
      <Field
        label="Toxicity note"
        id={`tox-${locale}`}
        value={f.toxicityNote}
        onChange={(e) => set("toxicityNote")(e.target.value)}
        rows={2}
        hint="What happens if a pet or child eats it. Leave blank only if genuinely unknown."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || changed.length === 0}>
          {pending
            ? "Saving…"
            : justSaved
              ? "Saved"
              : changed.length > 1
                ? `Save ${changed.length} languages`
                : "Save"}
        </Button>

        {justSaved && !pending ? (
          <span className="flex items-center gap-1 text-[12px] text-success">
            <Check className="size-3.5" aria-hidden="true" />
            Live on the storefront
          </span>
        ) : null}

        {/* Named, because the button is at the bottom of whichever tab happens
            to be open and the other two are out of sight. */}
        {!pending && !justSaved && changed.length > 0 ? (
          <span className="text-[12px] text-text-tertiary">
            Unsaved: {changed.map((l) => LOCALE_LABEL[l]).join(", ")}
          </span>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] leading-relaxed text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        rows={rows ?? 1}
        className="w-full resize-y rounded-sm border border-border-default bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
      />
      {hint ? <p className="text-[11px] leading-relaxed text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------- attributes --

export function AttributesForm({
  productId,
  attributes,
}: {
  productId: string;
  attributes: PlantAttributes | null;
}) {
  const { pending, error, saved, run } = useSave();
  const a = attributes ?? {
    light: null,
    water: null,
    petSafe: null,
    difficulty: null,
    matureHeightCm: null,
    placement: null,
    airPurifying: null,
  };
  const [f, setF] = useState(a);

  // Same adjust-during-render pattern as the copy form above.
  const { draft, appliedAt } = useAiDraft();
  const [seenDraft, setSeenDraft] = useState(appliedAt);

  if (appliedAt !== seenDraft) {
    setSeenDraft(appliedAt);
    if (draft) {
      const d = draft.attributes;
      setF((prev) => ({
        ...prev,
        // A care value the model could not place comes back null, and null must
        // leave what is already there rather than blank a setting someone chose.
        light: d.light ?? prev.light,
        water: d.water ?? prev.water,
        difficulty: d.difficulty ?? prev.difficulty,
        placement: d.placement ?? prev.placement,
        matureHeightCm: d.matureHeightCm ?? prev.matureHeightCm,
        airPurifying: d.airPurifying,
        // A draft can lower this to "toxic" but can never raise it to "safe":
        // `petSafe` is typed `false | null`, and null keeps whatever a person
        // already decided — including their verification that it is safe.
        petSafe: d.petSafe ?? prev.petSafe,
      }));
    }
  }

  const dirty = JSON.stringify(f) !== JSON.stringify(a);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateAttributes(productId, {
            light: f.light,
            water: f.water,
            difficulty: f.difficulty,
            placement: f.placement,
            petSafe: f.petSafe,
            airPurifying: f.airPurifying,
            matureHeightCm: f.matureHeightCm,
          }),
        );
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          label="Light"
          value={f.light}
          options={LIGHT_LEVELS}
          onChange={(v) => setF({ ...f, light: v as PlantAttributes["light"] })}
        />
        <Choice
          label="Water"
          value={f.water}
          options={WATER_FREQUENCIES}
          onChange={(v) => setF({ ...f, water: v as PlantAttributes["water"] })}
        />
        <Choice
          label="Difficulty"
          value={f.difficulty}
          options={DIFFICULTIES}
          onChange={(v) => setF({ ...f, difficulty: v as PlantAttributes["difficulty"] })}
        />
        <Choice
          label="Placement"
          value={f.placement}
          options={PLACEMENTS}
          onChange={(v) => setF({ ...f, placement: v as PlantAttributes["placement"] })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="height">Mature height (cm)</Label>
        <Input
          id="height"
          type="number"
          min={0}
          value={f.matureHeightCm ?? ""}
          onChange={(e) =>
            setF({ ...f, matureHeightCm: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="numeric h-8 w-32 rounded-sm text-[13px]"
        />
      </div>

      {/*
        Pet safety is three-state and the third state is the important one.
        NULL means nobody has checked — rendering that as "safe" is how a
        customer poisons a cat, so it is a distinct choice here, never a
        default and never an unchecked box.
      */}
      <div className="flex flex-col gap-2">
        <Label>Pet safe</Label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: true, label: "Safe" },
            { v: false, label: "Toxic" },
            { v: null, label: "Not verified" },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setF({ ...f, petSafe: o.v })}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] transition-colors",
                f.petSafe === o.v
                  ? "border-ink-950 bg-ink-950 text-ink-50"
                  : "border-border-default text-text-secondary hover:border-border-strong",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          “Not verified” is not the same as safe, and the storefront never shows it as
          safe. Leave it there until someone has actually checked.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={f.airPurifying === true}
          onChange={(e) => setF({ ...f, airPurifying: e.target.checked })}
          className="size-4 shrink-0 accent-ink-950"
        />
        <span className="text-[13px]">Air purifying</span>
      </label>

      <SaveRow pending={pending} saved={saved} error={error} dirty={dirty} />
    </form>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`choice-${label}`}>{label}</Label>
      <Select
        value={value ?? NOT_SET}
        onValueChange={(v) => onChange(v === NOT_SET ? null : v)}
      >
        <SelectTrigger id={`choice-${label}`} className="h-8 rounded-sm text-[13px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_SET}>Not set</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o.replace(/-/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// --------------------------------------------------------------- variants --

// ----------------------------------------------------------------- delete --

/**
 * Deleting a plant.
 *
 * Confirmation is by typing the name, not by clicking twice. Two clicks in the
 * same spot is not a decision — the second one is muscle memory finishing what
 * the first started. Copying out a name is the only cheap confirmation that
 * cannot be performed by accident.
 *
 * The action itself refuses any plant that appears on an order, so the worst
 * this button can do is remove something nobody ever bought.
 */
export function DeleteProduct({
  productId,
  productName,
  isActive,
}: {
  productId: string;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === productName.trim().toLowerCase();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-text-tertiary">
          Removes the plant, its copy, sizes, stock and photographs for good. A plant that
          has ever been ordered cannot be deleted — hide it instead.
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Delete this plant
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isActive ? (
        <p className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-[12px] leading-relaxed">
          This plant is live in the shop right now.
        </p>
      ) : null}

      <Label htmlFor="confirm-delete" className="text-[12px] font-normal leading-relaxed">
        Type <strong className="font-medium">{productName}</strong> to confirm.
      </Label>
      <Input
        id="confirm-delete"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        autoFocus
        className="h-8 max-w-sm rounded-sm text-[13px]"
      />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || !matches}
          onClick={() => {
            setError(null);
            start(async () => {
              const result = await deleteProduct(productId);
              if (result.ok) {
                router.push("/admin/products");
              } else {
                setError(result.error);
              }
            });
          }}
        >
          {pending ? "Deleting…" : "Delete for good"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
        >
          Keep it
        </Button>
      </div>
    </div>
  );
}
