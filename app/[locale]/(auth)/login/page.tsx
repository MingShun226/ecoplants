import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInForm } from "@/components/features/auth-forms";
import { getSessionCustomer } from "@/lib/account/session";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("signInTitle") };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in? The login page is a dead end.
  if (await getSessionCustomer()) redirect({ href: "/account", locale });

  const t = await getTranslations("account");

  return (
    <div>
      <h1 className="font-display text-display-sm leading-[1.04]">{t("signInTitle")}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{t("signInLead")}</p>

      <div className="mt-9">
        <SignInForm />
      </div>

      <p className="mt-9 rounded-lg bg-surface-sunken px-5 py-4 text-[13px] leading-relaxed text-text-secondary">
        {t("guestNote")}
      </p>
    </div>
  );
}
