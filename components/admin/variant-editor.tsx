"use client";

import { Boxes, ChevronDown, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdjustStockForm } from "@/components/admin/stock-forms";
import { updateVariant } from "@/lib/admin/catalogue-actions";
import type { VariantRow } from "@/lib/admin/catalogue";
import { formatSen } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

      <Button type="submit" size="sm" className="w-fit" disabled={pending || !dirty}>
        {pending ? "Saving…" : saved ? "Saved" : "Save variant"}
      </Button>
    </form>
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
