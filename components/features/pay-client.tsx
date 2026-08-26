"use client";

import { CreditCard, Landmark, QrCode, TriangleAlert, Wallet } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { abandonOrder, payForOrder } from "@/lib/checkout/actions";
import { toMajor } from "@/lib/utils/format";

/**
 * The stand-in payment gateway.
 *
 * It is built to look like what it replaces — order reference, amount, chosen
 * method, confirm and cancel — so the surrounding flow is genuinely exercised.
 * But it says plainly, on screen, that nothing is charged. A fake payment page
 * that looks convincing and *doesn't* say so is the kind of thing that ends up
 * in front of a real customer.
 *
 * The seam is narrow on purpose: a real gateway redirects here, the customer
 * pays there, and its webhook calls the same `confirm_payment()` this button
 * calls. Everything downstream — committing the reservation, stamping paid_at,
 * the timeline entry — is already the real implementation.
 */
const METHOD_ICON: Record<string, typeof Landmark> = {
  fpx: Landmark,
  duitnow: QrCode,
  ewallet: Wallet,
  card: CreditCard,
};

export function PayClient({
  orderId,
  orderNo,
  totalSen,
  method,
}: {
  orderId: string;
  orderNo: string;
  totalSen: number;
  method: string;
}) {
  const t = useTranslations("pay");
  const tc = useTranslations("checkout");
  const router = useRouter();
  const format = useFormatter();
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = METHOD_ICON[method] ?? Landmark;
  const methodLabel = ["fpx", "duitnow", "ewallet", "card"].includes(method) ? tc(method) : method;

  const run = (fn: () => Promise<{ ok: true; status: string } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        router.replace(`/order/${orderId}`);
      } else {
        setError(result.error);
        setCancelling(false);
      }
    });
  };

  return (
    <div className="container-narrow section-y">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{t("title")}</p>
        <h1 className="mt-3 font-display text-3xl leading-tight">{t("dummyTitle")}</h1>

        {/* Said in plain language, above the fold, before the button. */}
        <div className="mt-6 flex gap-3 rounded-xl border border-warning/40 bg-warning-soft px-5 py-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-relaxed">{t("dummyBody")}</p>
        </div>

        <dl className="mt-8 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-sm text-text-secondary">{t("reference")}</dt>
            <dd className="numeric text-sm font-medium">{orderNo}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-sm text-text-secondary">{t("method")}</dt>
            <dd className="flex items-center gap-2 text-sm">
              <Icon className="size-4 text-text-tertiary" aria-hidden="true" />
              {methodLabel}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-sm text-text-secondary">{t("amount")}</dt>
            <dd className="numeric font-display text-xl">
              {format.number(toMajor(totalSen), "currency")}
            </dd>
          </div>
        </dl>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed"
          >
            {error}
          </p>
        ) : null}

        <Button
          size="lg"
          className="mt-8 w-full"
          disabled={pending}
          onClick={() => run(() => payForOrder(orderId, method))}
        >
          {pending && !cancelling ? t("working") : t("confirm")}
        </Button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setCancelling(true);
            run(() => abandonOrder(orderId));
          }}
          className="mt-4 w-full text-center text-[13px] text-text-tertiary underline-offset-4 transition-colors hover:text-danger hover:underline disabled:opacity-50"
        >
          {pending && cancelling ? t("cancelling") : t("cancel")}
        </button>
      </div>
    </div>
  );
}
