import { Check, MapPin, Package, Truck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ClaimOrderButton } from "@/components/features/claim-order-button";
import { ownsOrder } from "@/lib/account/orders";
import { getSessionCustomer } from "@/lib/account/session";
import { getReceipt } from "@/lib/checkout/receipt";
import { toMajor } from "@/lib/utils/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "receipt" });
  // The URL is the capability to read this order. Keep it out of every index.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);

  const receipt = await getReceipt(orderId);
  if (!receipt) notFound();

  // Whether to offer "save this to my account". Only for a signed-in customer
  // looking at an order that is not already theirs — the link in the URL is the
  // proof, so this grants nothing they cannot already do by keeping the link.
  const customer = await getSessionCustomer();
  const canClaim = customer !== null && !(await ownsOrder(orderId));

  const [t, ts, tc, ta, format] = await Promise.all([
    getTranslations("receipt"),
    getTranslations("shipping"),
    getTranslations("cart"),
    getTranslations("actions"),
    getFormatter(),
  ]);

  const money = (sen: number) => format.number(toMajor(sen), "currency");
  const addr = receipt.shippingAddress;

  const paid = receipt.status !== "pending" && receipt.status !== "cancelled";
  const cancelled = receipt.status === "cancelled";

  const heading = cancelled
    ? t("cancelledTitle")
    : paid
      ? t("title")
      : t("pendingTitle");
  const lead = cancelled
    ? t("cancelledLead")
    : paid
      ? t("lead", { email: receipt.email })
      : t("pendingLead");

  return (
    <div className="container-narrow section-y">
      <div className="mx-auto max-w-2xl">
        <span
          aria-hidden="true"
          className={`inline-flex size-11 items-center justify-center rounded-full ${
            cancelled ? "bg-surface-sunken text-text-tertiary" : "bg-leaf-800 text-ink-50"
          }`}
        >
          {cancelled ? <Package className="size-5" /> : <Check className="size-5" />}
        </span>

        <DisplayHeading as="h1" lead={heading} size="sm" className="mt-6" />
        <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">{lead}</p>

        <dl className="mt-10 grid gap-x-8 gap-y-5 border-y border-border-subtle py-6 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
              {t("number")}
            </dt>
            <dd className="numeric mt-1.5 text-sm font-medium">{receipt.orderNo}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
              {t("placed")}
            </dt>
            <dd className="mt-1.5 text-sm">
              {format.dateTime(new Date(receipt.placedAt), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kuala_Lumpur",
              })}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
              {t("deliverTo")}
            </dt>
            <dd className="mt-1.5 flex gap-2 text-sm leading-relaxed">
              <MapPin className="mt-0.5 size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
              <span>
                {receipt.fullName}
                <br />
                {addr.line1}
                {addr.line2 ? (
                  <>
                    <br />
                    {addr.line2}
                  </>
                ) : null}
                <br />
                {addr.postcode} {addr.city}, {addr.state}
              </span>
            </dd>
          </div>
          {receipt.trackingNo ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                {t("tracking")}
              </dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm">
                <Truck className="size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
                <span className="numeric">{receipt.trackingNo}</span>
                {receipt.courier ? (
                  <span className="text-text-tertiary">· {receipt.courier}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <ul className="divide-y divide-border-subtle">
          {receipt.lines.map((line) => (
            <li key={line.sku} className="flex items-baseline gap-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{line.productName}</span>
                <span className="block text-[13px] capitalize text-text-tertiary">
                  {line.variantLabel} · <span className="numeric">{line.quantity}</span> ×{" "}
                  {money(line.unitPriceSen)}
                </span>
              </span>
              <span className="numeric shrink-0 text-[15px]">
                {money(line.unitPriceSen * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2.5 border-t border-border-subtle pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">{tc("subtotal")}</dt>
            <dd className="numeric">{money(receipt.subtotalSen)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">{tc("delivery")}</dt>
            <dd className="numeric">
              {receipt.shippingFeeSen === 0 ? tc("free") : money(receipt.shippingFeeSen)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border-subtle pt-3 font-display text-lg">
            <dt>{tc("total")}</dt>
            <dd className="numeric">{money(receipt.totalSen)}</dd>
          </div>
        </dl>

        {/* An unpaid order still holds its stock, so the way back to paying for
            it has to be on this page — it is the only link the customer has. */}
        {!paid && !cancelled ? (
          <Button asChild size="lg" className="mt-8 w-full">
            <Link href={`/pay/${orderId}`}>{t("payNow")}</Link>
          </Button>
        ) : null}

        {paid ? (
          <div className="mt-12">
            <h2 className="font-display text-xl">{t("whatNext")}</h2>
            <ol className="mt-5 space-y-4">
              {[t("step1"), t("step2"), t("step3")].map((step, i) => (
                <li key={step} className="flex gap-4 text-sm leading-relaxed text-text-secondary">
                  <span className="numeric font-display text-lg leading-none text-clay-500">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-relaxed text-text-secondary">
              {ts(receipt.isEastMalaysia ? "eastMalaysia" : "peninsular")}
            </p>
          </div>
        ) : null}

        {canClaim ? <ClaimOrderButton orderId={orderId} /> : null}

        {/* Only worth saying to someone who has no account to fall back on. */}
        {customer === null ? (
          <p className="mt-10 rounded-lg bg-surface-sunken px-5 py-4 text-[13px] leading-relaxed text-text-secondary">
            {t("keepLink")}
          </p>
        ) : null}

        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/category/indoor">{ta("shopPlants")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
