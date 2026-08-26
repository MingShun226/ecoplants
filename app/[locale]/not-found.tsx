import { useTranslations } from "next-intl";
import { DisplayHeading } from "@/components/brand/display-heading";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");
  const ta = useTranslations("actions");

  return (
    <div className="container-narrow flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="numeric font-display text-6xl text-clay-500">404</p>
      <DisplayHeading as="h1" lead={t("title")} size="sm" className="mt-6" />
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-text-secondary">{t("body")}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="px-7">
          <Link href="/category/indoor">{ta("shopPlants")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="px-7">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
      <Link
        href="/quiz"
        className="mt-6 text-sm text-clay-700 underline-offset-4 transition-colors hover:underline"
      >
        {ta("takeQuiz")}
      </Link>
    </div>
  );
}
