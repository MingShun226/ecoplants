import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
        <PlantQuiz products={await getProducts()} />
      </div>
    </div>
  );
}
