"use client";

import { ArrowRight, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PlantImage } from "@/components/brand/plant-image";
import { useCart } from "@/components/features/cart-provider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useShopSettings } from "@/components/features/settings-provider";
import { toMajor } from "@/lib/utils/format";

/**
 * Slide-over basket.
 *
 * Hand-built rather than dropped on shadcn's Sheet because the motion matters
 * here: the panel eases out from the right edge on the house curve while the
 * scrim fades on a slower one, so it reads as depth rather than one rigid
 * object sliding in. Sheet ships a fixed slide with its own timing.
 *
 * The behaviours that make a drawer feel finished, all present: click the scrim
 * to close, Escape to close, the page behind cannot scroll.
 *
 * Rendered through a portal onto <body>. It is opened from the header, and the
 * header carries `on-dark-tokens` while it floats over the dark hero — a drawer
 * left inside that subtree would inherit near-white text tokens and paint them
 * onto its own cream panel. Invisible copy. Portalling fixes the inheritance
 * and the stacking context in one move.
 */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("cart");
  const ta = useTranslations("actions");
  const ts = useTranslations("shipping");
  const tSize = useTranslations("sizes");
  const tColor = useTranslations("potColors");
  const tMaterial = useTranslations("potMaterials");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const { lines, subtotalSen, setQty, remove } = useCart();

  // Portals need document.body, which does not exist during the server render.
  // useSyncExternalStore answers "are we on the client" in one pass — the
  // useState + useEffect version costs an extra render on every mount.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Above the `mounted` early return: hooks have to run in the same order on
  // every render, and this component bails out before painting until the
  // portal target exists.
  const settings = useShopSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const money = (sen: number) => format.number(toMajor(sen), "currency");
  const remainingSen = Math.max(0, settings.freeShippingThresholdSen - subtotalSen);
  const progress = Math.min(100, (subtotalSen / settings.freeShippingThresholdSen) * 100);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70]">
          {/* Scrim — its own slower curve, so the panel leads and the dim follows. */}
          <m.button
            type="button"
            aria-label={ta("close")}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 h-full w-full cursor-default bg-ink-950/45 backdrop-blur-[2px]"
          />

          <m.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[27rem] flex-col bg-canvas text-text-primary shadow-overlay"
          >
            <header className="flex items-center justify-between border-b border-border-subtle px-6 py-5">
              <h2 className="font-display text-xl">{t("title")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={ta("close")}
                className="-mr-2 flex size-10 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-text-primary"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
                <ShoppingBag className="size-8 text-border-strong" aria-hidden="true" />
                <div>
                  <p className="font-display text-lg">{t("emptyTitle")}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {t("emptyBody")}
                  </p>
                </div>
                <Button asChild className="px-6" onClick={onClose}>
                  <Link href="/category/indoor">{ta("shopPlants")}</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Free-shipping progress sits at the top of the drawer, where it
                    can still change the order — at the bottom it is just a
                    receipt of a decision already made. */}
                <div className="border-b border-border-subtle px-6 py-4">
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    {remainingSen === 0
                      ? t("freeShippingReached")
                      : t("freeShippingRemaining", { amount: money(remainingSen) })}
                  </p>
                  <div
                    className="mt-3 h-px w-full bg-border-default"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("freeShippingProgress")}
                  >
                    <div
                      className="h-px bg-clay-600 transition-[width] duration-500 ease-refined"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <ul className="flex-1 overflow-y-auto">
                  {lines.map((line) => {
                    const tr = line.product.t[locale];
                    const colour = tColor(line.variant.potColorKey);
                    const material = tMaterial(line.variant.potMaterialKey);
                    return (
                      <li
                        key={line.variant.id}
                        className="flex gap-4 border-b border-border-subtle px-6 py-5"
                      >
                        <Link
                          href={`/plants/${tr.slug}`}
                          onClick={onClose}
                          className="relative aspect-4/5 w-20 shrink-0 overflow-hidden rounded-md bg-surface-sunken"
                        >
                          <PlantImage product={line.product} sizes="80px" />
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-display text-[15px]">
                                <Link href={`/plants/${tr.slug}`} onClick={onClose}>
                                  {tr.name}
                                </Link>
                              </p>
                              <p className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                                {tSize(line.variant.sizeKey)} ·{" "}
                                {colour === material ? colour : `${colour} ${material}`}
                              </p>
                            </div>
                            <p className="numeric shrink-0 text-sm font-medium">
                              {money(line.variant.priceSen * line.qty)}
                            </p>
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            <div className="inline-flex h-8 items-center rounded-full border border-border-default">
                              <button
                                type="button"
                                onClick={() => setQty(line.variant.id, line.qty - 1)}
                                aria-label={ta("decrease")}
                                className="inline-flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-text-primary"
                              >
                                <Minus className="size-3" aria-hidden="true" />
                              </button>
                              <span className="numeric min-w-5 text-center text-[13px]">
                                {line.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(line.variant.id, line.qty + 1)}
                                disabled={line.qty >= line.variant.quantityOnHand}
                                aria-label={ta("increase")}
                                className="inline-flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-40"
                              >
                                <Plus className="size-3" aria-hidden="true" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(line.variant.id)}
                              className="text-[13px] text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
                            >
                              {ta("remove")}
                            </button>
                          </div>

                          {line.product.peninsularOnly ? (
                            <p className="mt-2.5 text-[11px] text-warning">
                              {t("peninsularOnlyShort")}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <footer className="border-t border-border-subtle px-6 py-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-text-secondary">{t("subtotal")}</span>
                    <span className="numeric font-display text-xl">{money(subtotalSen)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-text-tertiary">{t("taxAtCheckout")}</p>

                  <Button asChild size="lg" className="mt-5 w-full" onClick={onClose}>
                    <Link href="/checkout">
                      {ta("checkout")}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>

                  <p className="mt-3 text-center text-[11px] leading-relaxed text-text-tertiary">
                    {ts("peninsular")}
                  </p>
                </footer>
              </>
            )}
          </m.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
