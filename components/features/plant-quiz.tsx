"use client";

import { ArrowRight, PawPrint } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DisplayHeading } from "@/components/brand/display-heading";
import { PlantImage } from "@/components/brand/plant-image";
import { RuledEyebrow } from "@/components/brand/primitives";
import { CareLine, PetSafetyBadge } from "@/components/features/care";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { avoidList, quizQuestions, scoreQuiz, type QuizAnswers } from "@/lib/data/quiz";
import { recordQuizResponse } from "@/lib/data/quiz-actions";
import { toMajor } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { fromPriceSen, type Product } from "@/types/catalog";

export function PlantQuiz({ products }: { products: Product[] }) {
  const t = useTranslations("quiz");
  const ta = useTranslations("actions");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});

  const done = step >= quizQuestions.length;
  const question = quizQuestions[step];
  // Filled to match the "1 / 6" label — an empty bar on question one reads as
  // broken rather than as "not started".
  const progress = ((step + 1) / quizQuestions.length) * 100;

  const choose = (value: string) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    // A short beat before advancing so the selection is visible.
    window.setTimeout(() => setStep((s) => s + 1), 180);
  };

  if (done) {
    return (
      <Results
        products={products}
        answers={answers}
        onRestart={() => {
          setAnswers({});
          setStep(0);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-4">
        <div
          className="h-px flex-1 bg-border-default"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={quizQuestions.length}
          aria-label={t("progress", { step: step + 1, total: quizQuestions.length })}
        >
          <div
            className="h-px bg-clay-600 transition-[width] duration-500 ease-refined"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="numeric shrink-0 text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          {t("progress", { step: step + 1, total: quizQuestions.length })}
        </p>
      </div>

      <div className="mt-10">
        <DisplayHeading as="h1" lead={t(question.questionKey)} size="sm" />
        {question.helpKey ? (
          <p className="mt-3.5 text-[15px] leading-relaxed text-text-secondary">
            {t(question.helpKey)}
          </p>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-xl border border-border-subtle">
          {question.options.map((option) => {
            const selected = answers[question.id] === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                className={cn(
                  "group flex w-full items-center justify-between gap-4 border-b border-border-subtle px-6 py-5 text-left transition-colors duration-300 last:border-b-0",
                  selected ? "bg-leaf-50" : "bg-surface hover:bg-surface-sunken",
                )}
              >
                <span>
                  <span className="block font-display text-lg">{t(option.labelKey)}</span>
                  {option.hintKey ? (
                    <span className="mt-1 block text-sm text-text-tertiary">
                      {t(option.hintKey)}
                    </span>
                  ) : null}
                </span>
                <ArrowRight
                  className="size-4 shrink-0 -translate-x-1 text-clay-600 opacity-0 transition-all duration-300 ease-refined group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        {step > 0 ? (
          <Button variant="ghost" className="mt-6" onClick={() => setStep((s) => s - 1)}>
            {ta("back")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Results({
  products,
  answers,
  onRestart,
}: {
  products: Product[];
  answers: QuizAnswers;
  onRestart: () => void;
}) {
  const t = useTranslations("quiz");
  const ta = useTranslations("actions");
  const tp = useTranslations("product");
  const format = useFormatter();
  const locale = useLocale() as Locale;

  const matches = scoreQuiz(products, answers).slice(0, 3);
  const avoid = avoidList(products, answers);

  // Recorded once the results are actually reached — not per question, which
  // would log half-finished attempts as though they were opinions.
  //
  // Fire-and-forget on purpose: the action swallows its own failures, and a
  // shopper looking at their plants must never wait on analytics.
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || matches.length === 0) return;
    recorded.current = true;
    void recordQuizResponse(
      answers as Record<string, string>,
      matches.map((m) => m.product.id),
      locale,
    );
  }, [answers, matches, locale]);

  if (matches.length === 0) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <DisplayHeading as="h1" lead={t("noneTitle")} size="sm" />
        <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">{t("noneBody")}</p>
        <Button variant="outline" className="mt-8 px-6" onClick={onRestart}>
          {ta("startAgain")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <RuledEyebrow>{t("resultsEyebrow")}</RuledEyebrow>
        <DisplayHeading
          as="h1"
          lead={matches.length === 1 ? t("resultsHeadingOne") : t("resultsHeading", { count: matches.length })}
          accent={matches.length === 1 ? undefined : t("resultsHeadingAccent")}
          size="md"
        />
        <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary">
          {t("resultsLead")}
        </p>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-3">
        {matches.map((match, i) => {
          const tr = match.product.t[locale];
          return (
            <article
              key={match.product.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border bg-surface",
                i === 0 ? "border-clay-400" : "border-border-subtle",
              )}
            >
              <Link
                href={`/plants/${tr.slug}`}
                className="group relative block aspect-4/5 overflow-hidden bg-surface-sunken"
              >
                <PlantImage
                  product={match.product}
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  className="transition-transform duration-[900ms] ease-refined group-hover:scale-[1.045]"
                />
                {i === 0 ? (
                  <span className="absolute left-3.5 top-3.5 rounded-full bg-ink-950/85 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-ink-50 backdrop-blur-sm">
                    {t("bestMatch")}
                  </span>
                ) : null}
              </Link>

              <div className="flex flex-1 flex-col p-6">
                <CareLine attributes={match.product.attributes} />

                <h2 className="mt-2 font-display text-lg">
                  <Link href={`/plants/${tr.slug}`}>
                    {tr.name}
                  </Link>
                </h2>

                <p className="numeric mt-1 text-sm font-medium">
                  <span className="text-xs font-normal text-text-tertiary">{tp("from")} </span>
                  {format.number(toMajor(fromPriceSen(match.product)), "currency")}
                </p>

                <ul className="mt-5 space-y-2 text-sm">
                  {match.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2.5 text-text-secondary">
                      <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-leaf-500" />
                      {t(reason)}
                    </li>
                  ))}
                  {match.cautions.map((caution) => (
                    <li key={caution} className="flex gap-2.5 text-warning">
                      <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                      {t(caution)}
                    </li>
                  ))}
                </ul>

                {/* Cards stretch to the tallest in the row, so the CTA is pinned
                    to the bottom instead of floating wherever the reason list
                    happens to end. */}
                <div className="mt-auto pt-6">
                  <Button
                    asChild
                    variant={i === 0 ? "default" : "outline"}
                    className="w-full"
                  >
                    <Link href={`/plants/${tr.slug}`}>
                      {ta("viewDetails")}
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {avoid.length > 0 ? (
        <div className="mt-14 rounded-xl border border-border-subtle bg-surface-sunken p-8">
          <h2 className="flex items-center gap-2.5 font-display text-lg">
            <PawPrint className="size-5 text-warning" aria-hidden="true" />
            {t("avoidHeading")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{t("avoidBody")}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {avoid.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/plants/${product.t[locale].slug}`}
                  className="inline-flex items-center gap-2.5 rounded-full border border-border-default bg-surface px-3.5 py-2 text-sm text-text-secondary transition-colors hover:border-clay-400 hover:text-text-primary"
                >
                  {product.t[locale].name}
                  <PetSafetyBadge petSafe={false} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Button variant="outline" className="px-6" onClick={onRestart}>
          {t("retake")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/category/indoor">{t("browseInstead")}</Link>
        </Button>
      </div>
    </div>
  );
}
