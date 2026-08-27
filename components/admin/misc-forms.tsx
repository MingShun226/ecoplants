"use client";

import { ChevronDown, ChevronUp, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteReview,
  reorderCategory,
  setReviewApproved,
  removeCategoryImage,
  setNewArrival,
  updateCategoryTranslation,
  updateSettings,
  uploadCategoryImage,
} from "@/lib/admin/catalogue-actions";
import type { LocaleCode } from "@/lib/admin/enums";
import { LOCALE_LABEL, LOCALES } from "@/lib/admin/enums";
import type { ShopSettings } from "@/lib/admin/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- reviews --

/**
 * Moderation is two buttons and no ceremony. `is_approved` was always the gate
 * between a review and the storefront; this is the hand that moves it.
 *
 * Deleting asks twice, because a review is someone's writing and there is no
 * undo — the row is gone.
 */
export function ReviewControls({
  reviewId,
  isApproved,
}: {
  reviewId: string;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isApproved ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setReviewApproved(reviewId, false))}
          >
            Unpublish
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setReviewApproved(reviewId, true))}
          >
            Publish
          </Button>
        )}

        {confirming ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteReview(reviewId))}
            >
              {pending ? "Deleting…" : "Delete for good"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            aria-label="Delete review"
            className="flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- categories --

export function CategoryOrderControls({
  categoryId,
  isFirst,
  isLast,
}: {
  categoryId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const move = (direction: "up" | "down") =>
    start(async () => {
      await reorderCategory(categoryId, direction);
      router.refresh();
    });

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={pending || isFirst}
        onClick={() => move("up")}
        aria-label="Move up"
        className="flex size-6 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-25"
      >
        <ChevronUp className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={pending || isLast}
        onClick={() => move("down")}
        aria-label="Move down"
        className="flex size-6 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-25"
      >
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function CategoryCopyForm({
  categoryId,
  translations,
}: {
  categoryId: string;
  translations: { locale: LocaleCode; name: string; description: string | null }[];
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const current = translations.find((t) => t.locale === locale);
  const [name, setName] = useState(current?.name ?? "");
  const [description, setDescription] = useState(current?.description ?? "");

  const pick = (l: LocaleCode) => {
    const next = translations.find((t) => t.locale === l);
    setLocale(l);
    setName(next?.name ?? "");
    setDescription(next?.description ?? "");
    setError(null);
  };

  const dirty = name !== (current?.name ?? "") || description !== (current?.description ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await updateCategoryTranslation(categoryId, locale, { name, description });
          if (result.ok) {
            setSaved(true);
            router.refresh();
            window.setTimeout(() => setSaved(false), 2000);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {LOCALES.map((l) => {
          const has = translations.some((t) => t.locale === l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => pick(l)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
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

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        aria-label={`Name in ${LOCALE_LABEL[locale]}`}
        required
        className="h-8 rounded-sm text-[13px]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        aria-label={`Description in ${LOCALE_LABEL[locale]}`}
        rows={2}
        className="w-full resize-y rounded-sm border border-border-default bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
      />

      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="sm" variant="outline" disabled={pending || !dirty}>
        {pending ? "Saving…" : saved ? "Saved" : "Save"}
      </Button>
    </form>
  );
}

// --------------------------------------------------------------- settings --

export function SettingsForm({ settings }: { settings: ShopSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toMajor = (sen: number) => (sen / 100).toFixed(2);
  const [f, setF] = useState({
    freeShipping: toMajor(settings.freeShippingThresholdSen),
    standardShipping: toMajor(settings.standardShippingSen),
    guaranteeDays: String(settings.guaranteeDays),
    whatsapp: settings.whatsappNumber,
    lowStock: String(settings.lowStockThreshold),
  });

  const dirty =
    f.freeShipping !== toMajor(settings.freeShippingThresholdSen) ||
    f.standardShipping !== toMajor(settings.standardShippingSen) ||
    f.guaranteeDays !== String(settings.guaranteeDays) ||
    f.whatsapp !== settings.whatsappNumber ||
    f.lowStock !== String(settings.lowStockThreshold);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await updateSettings({
            freeShippingThresholdSen: Math.round(Number(f.freeShipping) * 100),
            standardShippingSen: Math.round(Number(f.standardShipping) * 100),
            guaranteeDays: Number(f.guaranteeDays),
            whatsappNumber: f.whatsapp,
            lowStockThreshold: Number(f.lowStock),
          });
          if (result.ok) {
            setSaved(true);
            router.refresh();
            window.setTimeout(() => setSaved(false), 2500);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="freeShipping">Free delivery above (RM)</Label>
          <Input
            id="freeShipping"
            type="number"
            step="0.01"
            min="0"
            value={f.freeShipping}
            onChange={(e) => setF({ ...f, freeShipping: e.target.value })}
            required
            className="numeric h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            Shown in the header, the basket progress bar, the footer and checkout.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="standardShipping">Delivery fee below that (RM)</Label>
          <Input
            id="standardShipping"
            type="number"
            step="0.01"
            min="0"
            value={f.standardShipping}
            onChange={(e) => setF({ ...f, standardShipping: e.target.value })}
            required
            className="numeric h-8 rounded-sm text-[13px]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="guaranteeDays">Survival guarantee (days)</Label>
          <Input
            id="guaranteeDays"
            type="number"
            min="0"
            step="1"
            value={f.guaranteeDays}
            onChange={(e) => setF({ ...f, guaranteeDays: e.target.value })}
            required
            className="numeric h-8 rounded-sm text-[13px]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lowStock">Low-stock warning at</Label>
          <Input
            id="lowStock"
            type="number"
            min="0"
            step="1"
            value={f.lowStock}
            onChange={(e) => setF({ ...f, lowStock: e.target.value })}
            required
            className="numeric h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            Drives the Overview alert and the Inventory “running low” view. Panel only —
            shoppers never see it.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="whatsapp">WhatsApp number</Label>
        <Input
          id="whatsapp"
          value={f.whatsapp}
          onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
          required
          className="numeric h-8 rounded-sm text-[13px] sm:w-64"
        />
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          Digits only, starting 60. This is the number every “chat to us” link on the
          storefront opens.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? "Saving…" : saved ? "Saved" : "Save settings"}
        </Button>
        {saved && !pending ? (
          <span className="text-[12px] text-success">Storefront updated.</span>
        ) : null}
      </div>
    </form>
  );
}

// ----------------------------------------------------------- new arrivals --

/**
 * How long this plant counts as newly arrived.
 *
 * Presets rather than a date picker: the question is "how long should this be
 * on the New Arrivals page", not "what is the exact expiry timestamp". Picking
 * a date by hand invites someone to choose one in the past.
 */
const NEW_PRESETS = [14, 30, 60, 90] as const;

export function NewArrivalControl({
  productId,
  daysLeft,
}: {
  productId: string;
  /**
   * Resolved against the clock **on the server**, and null when this is not a
   * new arrival. Comparing to Date.now() here would be an impure call during
   * render: unstable across re-renders, and a source of hydration mismatch.
   */
  daysLeft: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = daysLeft !== null && daysLeft > 0;

  const run = (days: number | null) =>
    start(async () => {
      setError(null);
      const result = await setNewArrival(productId, days);
      if (result.ok) router.refresh();
      else setError(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      {active ? (
        <p className="flex items-center gap-2 text-[13px]">
          <Sparkles className="size-3.5 shrink-0 text-leaf-700" aria-hidden="true" />
          On New arrivals for{" "}
          <span className="numeric font-medium">
            {daysLeft} more {daysLeft === 1 ? "day" : "days"}
          </span>
        </p>
      ) : (
        <p className="text-[13px] text-text-secondary">Not listed as a new arrival.</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {NEW_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={pending}
            onClick={() => run(d)}
            className="rounded-full border border-border-default px-2.5 py-1 text-[12px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            {active ? `Reset to ${d}d` : `${d} days`}
          </button>
        ))}
        {active ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(null)}
            className="rounded-full border border-border-default px-2.5 py-1 text-[12px] text-text-tertiary transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-text-tertiary">
        Expires on its own — no need to come back and switch it off.
      </p>
    </div>
  );
}

// ------------------------------------------------------- category images --

export function CategoryImageForm({
  categoryId,
  slug,
  name,
  src,
}: {
  categoryId: string;
  slug: string;
  name: string;
  src: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const upload = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("categoryId", categoryId);
      form.set("slug", slug);
      const result = await uploadCategoryImage(form);
      if (!result.ok) setError(result.error);
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex items-start gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-sunken">
        {src ? (
          <Image src={src} alt={name} fill sizes="64px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <ImageIcon className="size-4 text-text-tertiary" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => upload(e.target.files?.[0])}
          className="hidden"
          id={`cat-img-${categoryId}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Uploading…" : src ? "Replace" : "Add photo"}
          </Button>
          {src ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await removeCategoryImage(categoryId);
                  router.refresh();
                })
              }
            >
              Remove
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-[12px] leading-relaxed text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
