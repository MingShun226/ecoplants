import { ArrowRight, Sprout, Truck } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { ProfileForm, SignOutButton } from "@/components/features/auth-forms";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { listMyOrders } from "@/lib/account/orders";
import { formatPhone } from "@/lib/account/phone";
import { getSessionCustomer } from "@/lib/account/session";
import { toMajor } from "@/lib/utils/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  // A signed-in page has nothing to index and should not be crawled.
  return { title: t("myAccount"), robots: { index: false, follow: false } };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const customer = await getSessionCustomer();
  if (!customer) {
    redirect({ href: "/login", locale });
    // next-intl's redirect throws, but is not typed `never`, so TypeScript
    // cannot see that everything below is unreachable.
    return null;
  }

  const [t, ta, orders, format] = await Promise.all([
    getTranslations("account"),
    getTranslations("actions"),
    listMyOrders(),
    getFormatter(),
  ]);

  const money = (sen: number) => format.number(toMajor(sen), "currency");

  return (
    <div className="container-narrow section-y">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <DisplayHeading
              as="h1"
              lead={t("greeting", { name: customer.fullName ?? formatPhone(customer.phone) })}
              size="sm"
            />
            <p className="numeric mt-3 text-sm text-text-tertiary">
              {formatPhone(customer.phone)}
            </p>
          </div>
          <SignOutButton className="text-sm text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline" />
        </div>

        <section className="mt-14">
          <h2 className="font-display text-xl">{t("ordersTitle")}</h2>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border-subtle bg-surface px-6 py-12 text-center">
              <Sprout className="mx-auto size-6 text-border-strong" aria-hidden="true" />
              <p className="mt-4 font-display text-lg">{t("ordersEmpty")}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
                {t("ordersEmptyBody")}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/category/indoor">{ta("shopPlants")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/quiz">{t("ordersEmptyQuiz")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/order/${o.id}`}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-5 transition-opacity hover:opacity-80"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px]">{o.summary}</span>
                      <span className="numeric block text-[13px] text-text-tertiary">
                        {o.orderNo} ·{" "}
                        {format.dateTime(new Date(o.placedAt), {
                          dateStyle: "medium",
                          timeZone: "Asia/Kuala_Lumpur",
                        })}
                      </span>
                      {o.trackingNo ? (
                        <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
                          <Truck className="size-3.5" aria-hidden="true" />
                          <span className="numeric">{o.trackingNo}</span>
                          {o.courier ? <span className="text-text-tertiary">· {o.courier}</span> : null}
                        </span>
                      ) : null}
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="numeric block text-[15px]">{money(o.totalSen)}</span>
                      <span className="block text-[12px] capitalize text-text-tertiary">
                        {o.status}
                      </span>
                    </span>

                    <ArrowRight
                      className="size-4 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-14">
          <h2 className="font-display text-xl">{t("profileTitle")}</h2>
          <div className="mt-6">
            <ProfileForm fullName={customer.fullName ?? ""} />
          </div>
        </section>

        <p className="mt-14 rounded-lg bg-surface-sunken px-5 py-4 text-[13px] leading-relaxed text-text-secondary">
          {t("unverifiedNote")}
        </p>
      </div>
    </div>
  );
}
