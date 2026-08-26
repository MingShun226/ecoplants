import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PayClient } from "@/components/features/pay-client";
import { redirect } from "@/i18n/navigation";
import { getReceipt } from "@/lib/checkout/receipt";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pay" });
  // Never indexed: the URL contains the capability to see someone's order.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);

  const receipt = await getReceipt(orderId);
  if (!receipt) notFound();

  // Already paid, or cancelled: there is nothing to do here, and leaving the
  // pay button on screen invites a second attempt at an order that is done.
  if (receipt.status !== "pending") {
    // The locale-aware redirect, so it does not drop the prefix.
    redirect({ href: `/order/${orderId}`, locale });
  }

  const method = (await searchParams).method;
  return (
    <PayClient
      orderId={orderId}
      orderNo={receipt.orderNo}
      totalSen={receipt.totalSen}
      method={typeof method === "string" ? method : "fpx"}
    />
  );
}
