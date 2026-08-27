import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PlantQuiz } from "@/components/features/plant-quiz";
import { getProducts } from "@/lib/data/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  const th = await getTranslations({ locale, namespace: "home" });
  return { title: t("quiz"), description: th("quizLead") };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="section-y">
      <div className="container-page">
        {/* PlantQuiz reads the hero's answer off the query string, and
            useSearchParams suspends during prerender. Without this boundary the
            page cannot be built statically and falls back to rendering on every
            request — for a query param that is optional and usually absent. */}
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <PlantQuiz products={await getProducts()} />
        </Suspense>
      </div>
    </div>
  );
}
