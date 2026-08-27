import { ArrowRight, Package, Sprout, Truck } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
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
  const open = orders.filter((o) => !["delivered", "cancelled", "refunded"].includes(o.status));

  return (
    <div className="container-page section-y">
      {/*
        A banded header rather than a heading floating in whitespace. It carries
        the three things that identify the account — who, which number, since
        when — so the page opens with something solid.
      */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border-subtle pb-8">
        <div className="min-w-0">
          <h1 className="font-display text-display-sm leading-[1.04]">
            {t("greeting", { name: customer.fullName ?? formatPhone(customer.phone) })}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-tertiary">
            <span className="numeric">{formatPhone(customer.phone)}</span>
            <span aria-hidden="true" className="text-border-strong">
              ·
            </span>
            <span>
              {t("memberSince", {
                date: format.dateTime(new Date(customer.createdAt), {
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Kuala_Lumpur",
                }),
              })}
            </span>
          </p>
        </div>

        <SignOutButton className="text-sm text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline" />
      </header>

      {/* Orders carry the page, so they get the width. Details are reference
          material and sit beside them rather than under. */}
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">{t("ordersTitle")}</h2>
            {orders.length > 0 ? (
              <p className="text-[13px] text-text-tertiary">
                {open.length > 0 ? t("ordersOpen", { count: open.length }) : t("ordersAllDone")}
              </p>
            ) : null}
          </div>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border-subtle bg-surface px-6 py-14 text-center">
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
            <ul className="mt-6 flex flex-col gap-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/order/${o.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-border-subtle bg-surface px-5 py-4 transition-colors hover:border-border-strong"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
                      <Package className="size-4 text-text-tertiary" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{o.summary}</span>
                      <span className="numeric block text-[13px] text-text-tertiary">
                        {o.orderNo} ·{" "}
                        {format.dateTime(new Date(o.placedAt), {
                          dateStyle: "medium",
                          timeZone: "Asia/Kuala_Lumpur",
                        })}
                      </span>
                      {o.trackingNo ? (
                        <span className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
                          <Truck className="size-3.5" aria-hidden="true" />
                          <span className="numeric">{o.trackingNo}</span>
                          {o.courier ? (
                            <span className="text-text-tertiary">· {o.courier}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="numeric block text-[15px]">{money(o.totalSen)}</span>
                      <span className="block text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                        {o.status}
                      </span>
                    </span>

                    <ArrowRight
                      className="size-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border-subtle bg-surface p-6">
            <h2 className="font-display text-lg">{t("profileTitle")}</h2>
            <div className="mt-5">
              <ProfileForm fullName={customer.fullName ?? ""} />
            </div>

            <dl className="mt-6 border-t border-border-subtle pt-5">
              <dt className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
                {t("phone")}
              </dt>
              <dd className="numeric mt-1.5 text-sm">{formatPhone(customer.phone)}</dd>
              <dd className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                {t("phoneLocked")}
              </dd>
            </dl>
          </div>

          <p className="rounded-xl bg-surface-sunken px-5 py-4 text-[12px] leading-relaxed text-text-secondary">
            {t("unverifiedNote")}
          </p>
        </aside>
      </div>
    </div>
  );
}
