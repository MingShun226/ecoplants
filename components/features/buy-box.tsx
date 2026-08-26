"use client";

import { ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { openCartDrawer, useCart } from "@/components/features/cart-provider";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { useShopSettings } from "@/components/features/settings-provider";
import { toMajor } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Product, Variant } from "@/types/catalog";

/**
 * One PDP per product, with size and pot chosen here as variants rather than as
 * separate product pages — the information-architecture lesson from The Sill.
 * Price, stock and dimensions all follow the selection.
 *
 * Adding writes to the cart cookie and opens the drawer, so the confirmation is
 * the basket itself rather than a toast that disappears. The price shown here
 * is display-only — the real total is always recomputed server-side at order
 * creation.
 */
export function BuyBox({ product }: { product: Product }) {
  const t = useTranslations("product");
  const ta = useTranslations("actions");
  const ts = useTranslations("shipping");
  const tg = useTranslations("guarantee");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const { add } = useCart();

  const firstAvailable = product.variants.find((v) => v.quantityOnHand > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? firstAvailable,
    [product.variants, variantId, firstAvailable],
  );

  const soldOut = variant.quantityOnHand === 0;
  const lowStock = variant.quantityOnHand > 0 && variant.quantityOnHand <= 5;
  const settings = useShopSettings();
  const freeShipping = variant.priceSen >= settings.freeShippingThresholdSen;

  const onAdd = () => {
    add(variant.id);
    setAdded(true);
    // The drawer is the confirmation. Opening it a beat later lets the button's
    // own state change register first, so the two reads as cause and effect.
    window.setTimeout(openCartDrawer, 180);
    window.setTimeout(() => setAdded(false), 2200);
  };

  const money = (sen: number) => format.number(toMajor(sen), "currency");

  return (
    <>
      <div className="mt-7">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="numeric font-display text-[2.25rem] leading-none">
            {money(variant.priceSen)}
          </p>
          {variant.compareAtSen && variant.compareAtSen > variant.priceSen ? (
            <>
              <p className="numeric text-lg text-text-tertiary line-through">
                {money(variant.compareAtSen)}
              </p>
              <span className="rounded-full border border-clay-300 bg-clay-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-clay-800">
                {t("save", { amount: money(variant.compareAtSen - variant.priceSen) })}
              </span>
            </>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-text-tertiary">{t("includesPot")}</p>
      </div>

      <fieldset className="mt-8">
        <legend className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          {t("sizeAndPot")}
        </legend>
        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
          {product.variants.map((option) => (
            <VariantOption
              key={option.id}
              variant={option}
              selected={option.id === variant.id}
              onSelect={() => setVariantId(option.id)}
            />
          ))}
        </div>
      </fieldset>

      {/* Hairline spec strip — the same construction as the care grid. */}
      <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle text-center">
        {[
          {
            label: t("plantHeight"),
            value: format.number(variant.heightCm, "centimetre"),
          },
          {
            label: t("potWidth"),
            value: format.number(variant.potDiameterCm, "centimetre"),
          },
          { label: t("pot"), value: <PotMaterial variant={variant} /> },
        ].map((spec, i) => (
          <div key={i} className="bg-surface px-2 py-4">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
              {spec.label}
            </dt>
            <dd className="numeric mt-1 text-sm">{spec.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 space-y-3">
        <Button size="lg" className="w-full" disabled={soldOut} onClick={onAdd}>
          <ShoppingBag className="size-4" aria-hidden="true" />
          {soldOut ? ta("soldOut") : added ? ta("added") : ta("addToCart")}
        </Button>

        <p aria-live="polite" className="min-h-5 text-center text-sm">
          {soldOut ? (
            <span className="text-text-tertiary">{t("soldOutBody")}</span>
          ) : lowStock ? (
            <span className="text-warning">
              {t("lowStock", { count: variant.quantityOnHand })}
            </span>
          ) : (
            <span className="text-success">{t("inStock")}</span>
          )}
        </p>
      </div>

      <ul className="mt-8 space-y-3.5 border-t border-border-subtle pt-7 text-sm">
        <li className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-clay-600" aria-hidden="true" />
          <span className="text-text-secondary">
            <strong className="font-medium text-text-primary">{tg("headline", { days: settings.guaranteeDays })}.</strong>{" "}
            {tg("summary")}
          </span>
        </li>
        <li className="flex gap-3">
          <Truck className="mt-0.5 size-4.5 shrink-0 text-clay-600" aria-hidden="true" />
          <span className="text-text-secondary">
            {freeShipping ? (
              <>
                <strong className="font-medium text-text-primary">{t("freeDelivery")}</strong>{" "}
                {t("freeDeliveryOnSize")}{" "}
              </>
            ) : null}
            {ts("peninsular")}
            {product.peninsularOnly ? (
              <>
                {" "}
                <strong className="font-medium text-text-primary">{t("peninsularOnly")}</strong> —{" "}
                {t("peninsularOnlyBody")}
              </>
            ) : null}
          </span>
        </li>
      </ul>

      <StickyBar
        name={product.t[locale].name}
        variant={variant}
        soldOut={soldOut}
        added={added}
        onAdd={onAdd}
      />
    </>
  );
}

function PotMaterial({ variant }: { variant: Variant }) {
  const t = useTranslations("potMaterials");
  return <>{t(variant.potMaterialKey)}</>;
}

/**
 * Colour and material are separate fields because a cream fibreclay pot and a
 * cream ceramic pot are different products — but they often share a word, and
 * "Terracotta terracotta" is not a description.
 */
function PotDescription({ variant }: { variant: Variant }) {
  const tColor = useTranslations("potColors");
  const tMaterial = useTranslations("potMaterials");
  const colour = tColor(variant.potColorKey);
  const material = tMaterial(variant.potMaterialKey);
  return <>{colour === material ? colour : `${colour} · ${material}`}</>;
}

function VariantOption({
  variant,
  selected,
  onSelect,
}: {
  variant: Variant;
  selected: boolean;
  onSelect: () => void;
}) {
  const ts = useTranslations("sizes");
  const ta = useTranslations("actions");
  const format = useFormatter();
  const soldOut = variant.quantityOnHand === 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-300",
        selected
          ? "border-ink-950 bg-surface"
          : "border-border-default bg-surface hover:border-clay-400",
        soldOut && "opacity-55",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm">{ts(variant.sizeKey)}</span>
        <span className="block truncate text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
          <PotDescription variant={variant} />
          {soldOut ? ` · ${ta("soldOut")}` : ""}
        </span>
      </span>
      <span className="numeric shrink-0 text-sm font-medium">
        {format.number(toMajor(variant.priceSen), "currency")}
      </span>
    </button>
  );
}

/** Mobile sticky add-to-cart. Thumb-reachable, and it never covers the gallery. */
function StickyBar({
  name,
  variant,
  soldOut,
  added,
  onAdd,
}: {
  name: string;
  variant: Variant;
  soldOut: boolean;
  added: boolean;
  onAdd: () => void;
}) {
  const ta = useTranslations("actions");
  const ts = useTranslations("sizes");
  const format = useFormatter();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-canvas/95 backdrop-blur-md md:hidden">
      <div className="container-page flex items-center gap-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{name}</p>
          <p className="numeric text-xs text-text-tertiary">
            {ts(variant.sizeKey)} · {format.number(toMajor(variant.priceSen), "currency")}
          </p>
        </div>
        <Button size="lg" disabled={soldOut} onClick={onAdd} className="shrink-0">
          {soldOut ? ta("soldOut") : added ? ta("added") : ta("addToCart")}
        </Button>
      </div>
    </div>
  );
}
