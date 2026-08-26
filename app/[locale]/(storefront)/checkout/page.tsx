import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutClient } from "@/components/features/checkout-client";
import { formatPhone } from "@/lib/account/phone";
import { getSessionCustomer } from "@/lib/account/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  // Checkout is per-visitor and must never be indexed or cached at the edge.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Reading the session makes this route dynamic, which is the right trade for
  // one page: an account that does not save you retyping your own name and
  // number is not worth having. The 42 prerendered product pages are untouched.
  const customer = await getSessionCustomer();

  return (
    <CheckoutClient
      defaults={{
        fullName: customer?.fullName ?? "",
        phone: customer ? formatPhone(customer.phone) : "",
      }}
    />
  );
}
