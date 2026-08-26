import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DisplayHeading } from "@/components/brand/display-heading";
import { LeafRule, RuledEyebrow } from "@/components/brand/primitives";
import { RevealSection } from "@/components/features/reveal-section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSettings, whatsappUrl } from "@/lib/data/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guarantee" });
  const { guaranteeDays: days } = await getSettings();
  return { title: t("headline", { days }), description: t("summary") };
}

export default async function GuaranteePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = await getSettings();
  const days = settings.guaranteeDays;

  const t = await getTranslations("guarantee");
  const ta = await getTranslations("actions");
  const th = await getTranslations("home");
  const tw = await getTranslations("whatsapp");
  const tp = await getTranslations("product");

  const steps = [1, 2, 3] as const;

  return (
    <div className="section-y">
      <div className="container-narrow">
        <RevealSection className="flex flex-col items-start gap-5">
          <RuledEyebrow>{th("guaranteeEyebrow")}</RuledEyebrow>
          <DisplayHeading as="h1" lead={t("headline", { days })} size="lg" />
          <p className="text-lg leading-relaxed text-text-secondary">{t("summary")}</p>
          <p className="leading-relaxed text-text-secondary">{t("context")}</p>
        </RevealSection>

        <LeafRule className="my-14" />

        <RevealSection>
          <ol className="grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle">
            {steps.map((n) => (
              <li key={n} className="flex gap-6 bg-surface p-8">
                <span className="numeric font-display text-3xl leading-none text-clay-500">
                  {n}
                </span>
                <div>
                  <h2 className="font-display text-xl">{t(`step${n}Title`, { days })}</h2>
                  <p className="mt-2.5 leading-relaxed text-text-secondary">
                    {t(`step${n}Body`, { days })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </RevealSection>

        <RevealSection delay={0.08} className="mt-8 rounded-xl border border-border-subtle bg-surface-sunken p-8">
          <h2 className="font-display text-lg">{t("termsHeading")}</h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-text-secondary">
            {(["term1", "term2", "term3", "term4", "term5"] as const).map((key) => (
              <li key={key} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-clay-500" />
                {t(key, { days })}
              </li>
            ))}
          </ul>
        </RevealSection>

        <RevealSection delay={0.12} className="mt-8 rounded-xl border border-leaf-200 bg-leaf-50 p-8">
          <h2 className="font-display text-lg">{tp("variationHeading")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {th("storyBody")}
          </p>
        </RevealSection>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild size="lg" className="px-7">
            <a href={whatsappUrl(settings.whatsappNumber, tw("claim"))} target="_blank" rel="noopener noreferrer">
              {t("claimCta")}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-7">
            <Link href="/category/indoor">{t("backToPlants")}</Link>
          </Button>
        </div>

        <p className="sr-only">{ta("readTerms")}</p>
      </div>
    </div>
  );
}
