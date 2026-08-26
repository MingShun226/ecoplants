import { Droplet, Leaf, Moon, Ruler, Sun, SunMedium } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { difficultyKeys, difficultyLevel, lightKeys, waterKeys } from "@/lib/data/facets";
import { cn } from "@/lib/utils";
import type { PlantAttributes } from "@/types/catalog";

/** Icons stay on one stroke weight and a constrained size set. No second library. */
export function LightIcon({
  level,
  className,
}: {
  level: PlantAttributes["light"];
  className?: string;
}) {
  if (level === "low") return <Moon className={className} aria-hidden="true" />;
  if (level === "direct-sun") return <Sun className={className} aria-hidden="true" />;
  return <SunMedium className={className} aria-hidden="true" />;
}

/**
 * The card's fact line, in the site's ledger voice: quiet small-caps, the two
 * questions every buyer asks first. Everything else lives on the PDP.
 */
export function CareLine({
  attributes,
  className,
}: {
  attributes: PlantAttributes;
  className?: string;
}) {
  const t = useTranslations("attributes");
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary",
        className,
      )}
    >
      <LightIcon level={attributes.light} className="size-3.5" />
      {t(lightKeys[attributes.light])}
      <span aria-hidden="true" className="text-border-strong">
        ·
      </span>
      {t(waterKeys[attributes.water])}
    </span>
  );
}

/**
 * Pet safety is a purchase-blocking question, so it gets an unambiguous
 * three-state treatment: safe, toxic, or unverified. It is never rendered as
 * "safe" on missing data.
 */
export function PetSafetyBadge({
  petSafe,
  className,
}: {
  petSafe: boolean | null;
  className?: string;
}) {
  const t = useTranslations("pet");

  const tone =
    petSafe === true
      ? "border-leaf-300 bg-leaf-50 text-leaf-900"
      : petSafe === false
        ? "border-border-default bg-surface-sunken text-text-secondary"
        : "border-border-default bg-surface-sunken text-text-tertiary";

  const label = petSafe === true ? t("safe") : petSafe === false ? t("toxic") : t("unverified");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Leaf meter, 1–4. Reads faster than the word "moderate" on its own. */
export function DifficultyMeter({
  difficulty,
  className,
}: {
  difficulty: PlantAttributes["difficulty"];
  className?: string;
}) {
  const t = useTranslations("attributes");
  const level = difficultyLevel[difficulty];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <Leaf
            key={i}
            className={cn("size-3.5", i <= level ? "text-leaf-600" : "text-border-default")}
            fill={i <= level ? "currentColor" : "none"}
          />
        ))}
      </span>
      <span className="text-sm text-text-secondary">
        {t(difficultyKeys[difficulty])}
        <span className="sr-only"> — {t("careEffortLevel", { level })}</span>
      </span>
    </span>
  );
}

/**
 * The full attribute grid on the PDP. Hairline grid: gap-px over a
 * border-coloured ground draws dividers at every breakpoint without per-cell
 * border logic.
 */
export function CareGrid({ attributes }: { attributes: PlantAttributes }) {
  const t = useTranslations("attributes");
  const format = useFormatter();

  const size =
    attributes.matureHeightCm >= 100
      ? format.number(attributes.matureHeightCm / 100, "metre")
      : format.number(attributes.matureHeightCm, "centimetre");

  const rows = [
    {
      icon: <LightIcon level={attributes.light} className="size-5" />,
      label: t("light"),
      value: t(lightKeys[attributes.light]),
    },
    {
      icon: <Droplet className="size-5" aria-hidden="true" />,
      label: t("water"),
      value: t(waterKeys[attributes.water]),
    },
    {
      icon: <Ruler className="size-5" aria-hidden="true" />,
      label: t("matureSize"),
      value: t("upToTall", { size }),
    },
    {
      icon: <Leaf className="size-5" aria-hidden="true" />,
      label: t("careLevel"),
      value: t(difficultyKeys[attributes.difficulty]),
    },
  ];

  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="bg-surface px-5 py-5">
          <dt className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-text-tertiary">
            <span className="text-clay-600">{row.icon}</span>
            {row.label}
          </dt>
          <dd className="mt-2 text-sm">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
