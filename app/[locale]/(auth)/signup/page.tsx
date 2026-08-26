import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignUpForm } from "@/components/features/auth-forms";
import { getSessionCustomer } from "@/lib/account/session";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("signUpTitle") };
}

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (await getSessionCustomer()) redirect({ href: "/account", locale });

  const t = await getTranslations("account");

  return (
    <div>
      <h1 className="font-display text-display-sm leading-[1.04]">{t("signUpTitle")}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{t("signUpLead")}</p>

      <div className="mt-9">
        <SignUpForm />
      </div>

      {/* Said plainly rather than discovered later: a new account starts empty
          even for someone who has ordered here before. */}
      <p className="mt-9 rounded-lg bg-surface-sunken px-5 py-4 text-[13px] leading-relaxed text-text-secondary">
        {t("unverifiedNote")}
      </p>
    </div>
  );
}
