"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setProductActive,
  updateAttributes,
  updateProductFacts,
  updateTranslation,
  updateVariant,
} from "@/lib/admin/catalogue-actions";
import type { PlantAttributes, ProductDetail, ProductTranslation } from "@/lib/admin/catalogue";
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

const EMPTY: Omit<ProductTranslation, "locale"> = {
  name: "",
  slug: "",
  tagline: null,
  description: null,
  careSummary: null,
  climateNote: null,
  toxicityNote: null,
};

export function TranslationEditor({ product }: { product: ProductDetail }) {
  const [locale, setLocale] = useState<LocaleCode>("en");
  const existing = product.translations.find((t) => t.locale === locale);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {LOCALES.map((l) => {
          const has = product.translations.some((t) => t.locale === l);
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
              {!has ? (
                <span
                  className={cn("size-1.5 rounded-full", l === locale ? "bg-ink-50/60" : "bg-warning")}
                  aria-label="missing"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* key= remounts the form when the locale changes, so switching tabs does
          not carry one language's draft into another's fields. */}
      <TranslationForm
        key={locale}
        productId={product.id}
        locale={locale}
        initial={existing ?? { locale, ...EMPTY }}
        isNew={!existing}
      />
    </div>
  );
}

function TranslationForm({
  productId,
  locale,
  initial,
  isNew,
}: {
  productId: string;
  locale: LocaleCode;
  initial: ProductTranslation;
  isNew: boolean;
}) {
  const { pending, error, saved, run } = useSave();
  const [f, setF] = useState({
    name: initial.name,
    slug: initial.slug,
    tagline: initial.tagline ?? "",
    description: initial.description ?? "",
    careSummary: initial.careSummary ?? "",
    climateNote: initial.climateNote ?? "",
    toxicityNote: initial.toxicityNote ?? "",
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const dirty =
    f.name !== initial.name ||
    f.slug !== initial.slug ||
    f.tagline !== (initial.tagline ?? "") ||
    f.description !== (initial.description ?? "") ||
    f.careSummary !== (initial.careSummary ?? "") ||
    f.climateNote !== (initial.climateNote ?? "") ||
    f.toxicityNote !== (initial.toxicityNote ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateTranslation(productId, locale, f));
      }}
      className="flex flex-col gap-4"
    >
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
            onChange={set("name")}
            required
            className="h-8 rounded-sm text-[13px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`slug-${locale}`}>URL slug</Label>
          <Input
            id={`slug-${locale}`}
            value={f.slug}
            onChange={set("slug")}
            required
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] text-text-tertiary">
            /{locale}/plants/<span className="text-text-secondary">{f.slug || "…"}</span>
          </p>
        </div>
      </div>

      <Field label="Tagline" id={`tagline-${locale}`} value={f.tagline} onChange={set("tagline")} />
      <Field
        label="Description"
        id={`desc-${locale}`}
        value={f.description}
        onChange={set("description")}
        rows={4}
      />
      <Field
        label="Care summary"
        id={`care-${locale}`}
        value={f.careSummary}
        onChange={set("careSummary")}
        rows={2}
      />
      <Field
        label="Climate note"
        id={`climate-${locale}`}
        value={f.climateNote}
        onChange={set("climateNote")}
        rows={2}
        hint="Malaysian conditions specifically — humidity, monsoon, indoor aircon."
      />
      <Field
        label="Toxicity note"
        id={`tox-${locale}`}
        value={f.toxicityNote}
        onChange={set("toxicityNote")}
        rows={2}
        hint="What happens if a pet or child eats it. Leave blank only if genuinely unknown."
      />

      <SaveRow
        pending={pending}
        saved={saved}
        error={error}
        dirty={dirty}
        label={isNew ? `Add ${LOCALE_LABEL[locale]}` : "Save"}
      />
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

export function VariantPriceForm({
  variantId,
  sku,
  priceSen,
  compareAtSen,
}: {
  variantId: string;
  sku: string;
  priceSen: number;
  compareAtSen: number | null;
}) {
  const { pending, error, saved, run } = useSave();
  // Edited in ringgit because that is what a person thinks in; converted to sen
  // at the boundary, because that is what the database stores (ADR 0002).
  const toMajor = (sen: number | null) => (sen === null ? "" : (sen / 100).toFixed(2));
  const [price, setPrice] = useState(toMajor(priceSen));
  const [compare, setCompare] = useState(toMajor(compareAtSen));

  const dirty = price !== toMajor(priceSen) || compare !== toMajor(compareAtSen);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateVariant(variantId, {
            priceSen: Math.round(Number(price) * 100),
            compareAtSen: compare.trim() === "" ? null : Math.round(Number(compare) * 100),
          }),
        );
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`price-${variantId}`} className="text-[11px]">
          Price (RM)
        </Label>
        <Input
          id={`price-${variantId}`}
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="numeric h-8 w-28 rounded-sm text-[13px]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`compare-${variantId}`} className="text-[11px]">
          Was (RM)
        </Label>
        <Input
          id={`compare-${variantId}`}
          type="number"
          step="0.01"
          min="0"
          value={compare}
          onChange={(e) => setCompare(e.target.value)}
          placeholder="—"
          aria-label={`Compare-at price for ${sku}`}
          className="numeric h-8 w-28 rounded-sm text-[13px]"
        />
      </div>

      <Button type="submit" size="sm" variant="outline" disabled={pending || !dirty}>
        {pending ? "Saving…" : saved ? "Saved" : "Save"}
      </Button>

      {error ? (
        <p role="alert" className="w-full text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
