import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { LightIcon } from "@/components/features/care";
import { Link } from "@/i18n/navigation";
import { quizQuestions } from "@/lib/data/quiz";
import heroBackdrop from "@/public/images/hero.webp";

/**
 * The hero: one message, one action, one live object.
 *
 * Deliberately a server component. The entrance choreography is CSS
 * (`rise-in-lg`), so the markup is complete and correct even if no bundle ever
 * loads — a motion `initial` state would write opacity:0 into the server HTML
 * and blank the first screen on a failed bundle.
 *
 * The panel beside the headline is the plant finder's first question, asked
 * here rather than advertised. It replaced a board of four shortcuts into
 * filtered categories — the same four choices, but they dropped you into a
 * list, where this starts the thing that actually narrows it. Answering carries
 * through: the quiz reads the choice off the URL and opens on question two.
 */
export async function Hero() {
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");
  const tq = await getTranslations("quiz");

  // Light. Its four values are the same strings as the `light` plant attribute,
  // which is why LightIcon can draw them without a lookup table.
  const firstQuestion = quizQuestions[0];

  return (
    <section className="on-dark relative isolate overflow-hidden bg-[oklch(0.185_0.024_146)]">
      {/* A photograph, not a drawing: a monstera against a dark apartment wall
          at dusk, framed with its left two-thirds deliberately empty so the
          headline has somewhere to sit. Decorative — the headline already says
          what the page is — so it carries no alt text.

          `object-cover` means a tall viewport crops the sides. The subject sits
          right of centre and the left of the frame is near-black, so a centre
          crop on a phone lands on wall rather than on leaves, which is the half
          that keeps the copy readable. */}
      <Image
        src={heroBackdrop}
        alt=""
        aria-hidden="true"
        fill
        // The LCP element on the site's most-visited page.
        priority
        quality={82}
        sizes="100vw"
        className="-z-10 object-cover"
      />

      {/* Scrim. The photograph is already dark where the copy sits, but "already
          dark" is not a contrast guarantee across every crop this takes at every
          viewport, and the headline is the one thing here that has to stay
          readable. The flat layer carries small screens, where the crop is
          tightest and the copy runs full width; the angled layer weights the
          left on wide ones and clears before it reaches the plant. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[oklch(0.185_0.024_146/0.5)] lg:bg-[oklch(0.185_0.024_146/0.12)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            "linear-gradient(to top, oklch(0.185 0.024 146 / 0.55) 0%, transparent 22%)",
            "linear-gradient(100deg, oklch(0.185 0.024 146 / 0.92) 0%, oklch(0.185 0.024 146 / 0.66) 36%, transparent 70%)",
          ].join(", "),
        }}
      />

      <div className="container-page grid min-h-svh items-center gap-12 pb-16 pt-28 md:pt-32 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        {/* --- copy ------------------------------------------------------ */}
        <div className="flex max-w-2xl flex-col items-start gap-6 [text-shadow:0_2px_24px_oklch(0.185_0.024_146/0.85)]">
          <span
            className="rise-in-lg text-[10.5px] font-medium uppercase tracking-[0.24em] text-leaf-300"
            style={{ animationDelay: "0.05s" }}
          >
            {t("heroEyebrow")}
          </span>

          <h1 className="text-[clamp(2.5rem,1.3rem+4.2vw,4.25rem)] leading-[1.06] text-ink-50">
            <span className="rise-in-lg block" style={{ animationDelay: "0.12s" }}>
              {t("heroTitle")}
            </span>
            <span
              className="display-accent rise-in-lg block text-leaf-300"
              style={{ animationDelay: "0.2s" }}
            >
              {t("heroTitleAccent")}
            </span>
          </h1>

          <p
            className="rise-in-lg max-w-xl text-[16px] leading-relaxed text-text-secondary md:text-[17px]"
            style={{ animationDelay: "0.3s" }}
          >
            {t("heroLead")}
          </p>

          <Link
            href="/category/indoor"
            className="rise-in-lg group mt-2 inline-flex items-center gap-2.5 rounded-full bg-ink-50 px-7 py-3.5 text-sm font-medium text-ink-950 transition-colors duration-300 hover:bg-leaf-300"
            style={{ animationDelay: "0.42s" }}
          >
            {t("heroCta")}
            <ArrowRight
              className="size-4 transition-transform duration-300 ease-refined group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* --- the plant finder ------------------------------------------ */}
        <aside
          aria-label={tn("quiz")}
          className="rise-in-lg w-full overflow-hidden rounded-xl border border-leaf-400/30 bg-ink-950/70 backdrop-blur-md"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="flex flex-col gap-2 border-b border-ink-50/12 px-6 py-5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-leaf-300">
              {tn("quiz")}
            </span>
            <p className="text-[15px] leading-snug text-ink-50">{tq("q1")}</p>
          </div>

          <div>
            {firstQuestion.options.map((option) => (
              <Link
                key={option.value}
                // Answering here answers it for real: the quiz reads this off
                // the URL and opens on question two. The board this replaced
                // was a shortcut into a filtered category — the same four
                // choices, but they dropped you into a list instead of
                // starting the thing that narrows it.
                href={{ pathname: "/quiz", query: { [firstQuestion.id]: option.value } }}
                className="group flex items-start gap-3.5 border-b border-ink-50/12 px-6 py-3.5 transition-colors duration-300 last:border-b-0 hover:bg-ink-50/5"
              >
                <LightIcon
                  level={option.value as Parameters<typeof LightIcon>[0]["level"]}
                  className="mt-0.5 size-4 shrink-0 text-leaf-300"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] text-ink-50">{tq(option.labelKey)}</span>
                  {option.hintKey ? (
                    <span className="text-xs leading-relaxed text-text-tertiary">
                      {tq(option.hintKey)}
                    </span>
                  ) : null}
                </span>
                <ArrowRight
                  className="mt-1 size-3.5 -translate-x-1 shrink-0 text-leaf-300 opacity-0 transition-all duration-300 ease-refined group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>

          {/* What it costs to finish, so the first tap is an informed one. */}
          <p className="numeric border-t border-ink-50/12 px-6 py-3.5 text-[12px] text-text-tertiary">
            {quizQuestions.length} {t("quizStatQuestions")} · 60s {t("quizStatTime")}
          </p>
        </aside>
      </div>
    </section>
  );
}
