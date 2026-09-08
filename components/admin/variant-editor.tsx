"use client";

import { Boxes, ChevronDown, Plus, Ruler, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdjustStockForm } from "@/components/admin/stock-forms";
import { createVariant, deleteVariant, updateVariant } from "@/lib/admin/catalogue-actions";
import type { VariantRow } from "@/lib/admin/catalogue";
import { formatSen } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POT_COLOR_KEYS, POT_MATERIAL_KEYS, SIZE_KEYS } from "@/lib/admin/enums";
import { cn } from "@/lib/utils";

/**
 * One variant, everything about it, on the product page.
 *
 * Previously this was a price field here and a stock adjustment on a separate
 * Inventory screen. That split made the common job — "the 30cm Monstera is now
 * RM 20 more and we counted four fewer" — into two screens and a search. A
 * variant is one thing; it edits as one thing.
 *
 * Collapsed by default so a product with five variants is still a list rather
 * than five stacked forms. The row itself carries what you scan for: size,
 * SKU, price, and what is actually on the shelf.
 */
export function VariantEditor({
  variant,
  productName,
}: {
  variant: VariantRow;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const available = Math.max(0, variant.onHand - variant.reserved);

  return (
    <li className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-sunken"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] capitalize">{variant.sizeKey}</span>
          <span className="numeric block text-[11px] text-text-tertiary">{variant.sku}</span>
        </span>

        <span className="numeric shrink-0 text-[13px]">{formatSen(variant.priceSen)}</span>

        <span className="shrink-0 text-right">
          <span
            className={cn(
              "numeric block text-[13px]",
              available === 0 ? "text-danger" : undefined,
            )}
          >
            {available}
          </span>
          <span className="block text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
            available
          </span>
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-text-tertiary transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="grid gap-8 border-t border-border-subtle bg-surface-sunken px-5 py-5 lg:grid-cols-2">
          <VariantFields variant={variant} />

          <div>
            <p className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
              <Boxes className="size-3.5" aria-hidden="true" />
              Stock
            </p>
            <p className="numeric mt-2 text-[13px]">
              {variant.onHand} on hand
              {variant.reserved > 0 ? ` · ${variant.reserved} reserved` : ""}
            </p>
            <div className="mt-4">
              <AdjustStockForm
                variantId={variant.id}
                sku={variant.sku}
                productName={productName}
                onHand={variant.onHand}
                reserved={variant.reserved}
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function VariantFields({ variant }: { variant: VariantRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const money = (sen: number | null) => (sen === null ? "" : (sen / 100).toFixed(2));
  const num = (n: number | null) => (n === null ? "" : String(n));

  const [f, setF] = useState({
    sku: variant.sku,
    sizeKey: variant.sizeKey,
    potColorKey: variant.potColorKey ?? "terracotta",
    potMaterialKey: variant.potMaterialKey ?? "plastic",
    price: money(variant.priceSen),
    compare: money(variant.compareAtSen),
    weight: num(variant.weightGrams),
    height: num(variant.heightCm),
    diameter: num(variant.potDiameterCm),
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  const dirty =
    f.sku !== variant.sku ||
    f.sizeKey !== variant.sizeKey ||
    f.potColorKey !== (variant.potColorKey ?? "terracotta") ||
    f.potMaterialKey !== (variant.potMaterialKey ?? "plastic") ||
    f.price !== money(variant.priceSen) ||
    f.compare !== money(variant.compareAtSen) ||
    f.weight !== num(variant.weightGrams) ||
    f.height !== num(variant.heightCm) ||
    f.diameter !== num(variant.potDiameterCm);

  const optional = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await updateVariant(variant.id, {
            sku: f.sku,
            sizeKey: f.sizeKey,
            potColorKey: f.potColorKey,
            potMaterialKey: f.potMaterialKey,
            // Edited in ringgit because that is what a person thinks in;
            // converted to sen at the boundary (ADR 0002).
            priceSen: Math.round(Number(f.price) * 100),
            compareAtSen: f.compare.trim() === "" ? null : Math.round(Number(f.compare) * 100),
            weightGrams: optional(f.weight),
            heightCm: optional(f.height),
            potDiameterCm: optional(f.diameter),
          });
          if (result.ok) {
            setSaved(true);
            router.refresh();
            window.setTimeout(() => setSaved(false), 2000);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-5"
    >
      <div>
        <p className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">Identity</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Size" id={`size-${variant.id}`} value={f.sizeKey} onChange={set("sizeKey")} />
          <Field label="SKU" id={`sku-${variant.id}`} value={f.sku} onChange={set("sku")} mono />
        </div>
        {/*
          The pot is part of what is being sold, and it was neither shown here
          nor defaulted honestly: every product created claimed a charcoal
          ceramic pot. A shopper reads that line under the price and expects the
          pot in the photograph.
        */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PotChoice
            label="Pot colour"
            id={`pot-color-${variant.id}`}
            value={f.potColorKey}
            options={POT_COLOR_KEYS}
            onChange={(v) => setF({ ...f, potColorKey: v })}
          />
          <PotChoice
            label="Pot material"
            id={`pot-material-${variant.id}`}
            value={f.potMaterialKey}
            options={POT_MATERIAL_KEYS}
            onChange={(v) => setF({ ...f, potMaterialKey: v })}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
          Shown to the shopper under the price, as “Charcoal · Ceramic”. Describe the
          pot the plant actually ships in.
        </p>

        <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
          Size is a message key — it is translated in{" "}
          <code className="text-text-secondary">messages/*.json</code> under{" "}
          <code className="text-text-secondary">sizes</code>. A new one renders as the raw
          key until it is added there.
        </p>
      </div>

      <div>
        <p className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">Price</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Selling (RM)" id={`price-${variant.id}`} value={f.price} onChange={set("price")} type="number" step="0.01" min="0" required mono />
          <Field label="Was (RM)" id={`compare-${variant.id}`} value={f.compare} onChange={set("compare")} type="number" step="0.01" min="0" placeholder="—" mono />
        </div>
      </div>

      <div>
        <p className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
          <Ruler className="size-3.5" aria-hidden="true" />
          Size and weight
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label="Height (cm)" id={`h-${variant.id}`} value={f.height} onChange={set("height")} type="number" step="1" min="0" mono />
          <Field label="Pot Ø (cm)" id={`d-${variant.id}`} value={f.diameter} onChange={set("diameter")} type="number" step="1" min="0" mono />
          <Field label="Weight (g)" id={`w-${variant.id}`} value={f.weight} onChange={set("weight")} type="number" step="10" min="0" mono />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
          Height and pot diameter answer “how big is it really”, which is the question
          a plant bought online most often gets wrong. Weight is what a courier quote
          is priced on. Leave blank if genuinely unmeasured.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[12px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? "Saving…" : saved ? "Saved" : "Save variant"}
        </Button>

        {/* Removing sits at the far end of the row from saving, because the two
            are not a pair of options — one is the ordinary reason this panel is
            open and the other is not. */}
        <DeleteVariant variantId={variant.id} label={variant.sizeKey} />
      </div>
    </form>
  );
}

/** A pot attribute. The values are message keys, so they are chosen, not typed. */
function PotChoice({
  label,
  id,
  value,
  options,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[11px]">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 rounded-sm text-[13px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Field({
  label,
  id,
  mono,
  ...props
}: { label: string; id: string; mono?: boolean } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[11px]">
        {label}
      </Label>
      <Input
        id={id}
        {...props}
        className={cn("h-8 rounded-sm text-[13px]", mono && "numeric")}
      />
    </div>
  );
}

// --------------------------------------------------------------- add a size --

/**
 * Add a size to a plant that already exists.
 *
 * The four things that have no sensible default and would be wrong to guess.
 * Pot, weight and dimensions come out of the defaults every first variant
 * always got, and are corrected in the row this opens — asking for them here
 * turns adding a size into filling in a form.
 */
export function NewVariantForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ sizeKey: "medium", sku: "", price: "", stock: "0" });

  if (!open) {
    return (
      <div className="border-t border-border-subtle px-5 py-3.5">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="size-3.5" aria-hidden="true" />
          Add a size
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createVariant(productId, {
            sizeKey: f.sizeKey,
            sku: f.sku,
            // Edited in ringgit because that is what a person thinks in;
            // converted to sen at the boundary (ADR 0002).
            priceSen: Math.round(Number(f.price) * 100),
            quantityOnHand: Math.round(Number(f.stock) || 0),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setF({ sizeKey: "medium", sku: "", price: "", stock: "0" });
          setOpen(false);
          router.refresh();
        });
      }}
      className="flex flex-col gap-3 border-t border-border-subtle px-5 py-4"
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-size" className="text-[11px]">
            Size
          </Label>
          <Select value={f.sizeKey} onValueChange={(v) => setF({ ...f, sizeKey: v })}>
            <SelectTrigger id="new-size" className="h-8 rounded-sm text-[13px] capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_KEYS.map((k) => (
                <SelectItem key={k} value={k} className="capitalize">
                  {k.replace("-", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Field
          label="SKU"
          id="new-sku"
          value={f.sku}
          onChange={(e) => setF({ ...f, sku: e.target.value })}
          mono
        />

        <Field
          label="Price (RM)"
          id="new-price"
          value={f.price}
          onChange={(e) => setF({ ...f, price: e.target.value })}
          type="number"
          step="0.01"
          min="0.01"
        />

        <Field
          label="In stock"
          id="new-stock"
          value={f.stock}
          onChange={(e) => setF({ ...f, stock: e.target.value })}
          type="number"
          min="0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || f.sku.trim() === "" || Number(f.price) <= 0}
        >
          {pending ? "Adding…" : "Add size"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          Pot, weight and dimensions get defaults you can correct in the row this opens.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[12px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Remove a size.
 *
 * Two presses, because it does not come back. Safe after it has sold — an
 * order line keeps its own snapshot of the price, name and SKU — and refused
 * for the last one, because a plant with no sizes cannot be bought.
 */
export function DeleteVariant({ variantId, label }: { variantId: string; label: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={armed ? "destructive" : "ghost"}
          disabled={pending}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setError(null);
              return;
            }
            start(async () => {
              const result = await deleteVariant(variantId);
              if (!result.ok) {
                setError(result.error);
                setArmed(false);
                return;
              }
              router.refresh();
            });
          }}
          className="gap-1.5"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {pending ? "Removing…" : armed ? `Remove ${label} for good` : "Remove size"}
        </Button>
        {armed && !pending ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setArmed(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="max-w-md text-[12px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
