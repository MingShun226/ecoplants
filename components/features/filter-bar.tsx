"use client";

import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { facetGroups, sortOptions, type FacetCounts, type SortKey } from "@/lib/data/facets";
import { cn } from "@/lib/utils";

/**
 * Faceted filtering as a bar rather than a sidebar.
 *
 * Three things the sidebar got wrong and this fixes:
 *
 *  1. **No counts.** Every option now carries the number of plants it would
 *     yield, counted against the other groups' current selections. A dead end
 *     is visible before you click it, and an option that would yield nothing is
 *     disabled rather than hidden — hiding it makes the control jump under the
 *     cursor.
 *  2. **Active state was invisible on desktop.** Applied filters now show as
 *     removable chips on every breakpoint, not just mobile, and each group's
 *     trigger carries its own count.
 *  3. **It ate a fifth of the page.** The bar hands the full width back to the
 *     grid, which is what 4:5 plates want.
 *
 * Facets live in the URL, not in component state: a filtered listing has to be
 * shareable, backable and indexable. This file only ever writes the query
 * string; the server component re-renders from it.
 */

/** `basePath` is assembled at runtime from locale + slug, so typedRoutes cannot
 *  prove it — but it is always a real route and these writes only change the
 *  query string. */
type RuntimeRoute = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

export function FilterBar({
  basePath,
  counts,
  resultCount,
  totalCount,
}: {
  basePath: string;
  counts: FacetCounts;
  resultCount: number;
  totalCount: number;
}) {
  const t = useTranslations("plp");

  return (
    <div className="border-y border-border-subtle">
      <div className="flex items-center gap-3 py-3">
        {/* Desktop: one popover per group. */}
        <div className="hidden flex-1 items-center gap-2 lg:flex">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            {t("filter")}
          </span>
          {facetGroups.map((group) => (
            <FacetPopover key={group.param} group={group} basePath={basePath} counts={counts} />
          ))}
          <ClearAll basePath={basePath} />
        </div>

        {/* Mobile: one sheet holding every group. */}
        <MobileFilters basePath={basePath} counts={counts} resultCount={resultCount} />

        <p className="numeric ml-auto hidden text-sm text-text-secondary sm:block">
          {t("resultCount", { count: resultCount })}
          {resultCount !== totalCount ? (
            <span className="text-text-tertiary"> {t("ofTotal", { total: totalCount })}</span>
          ) : null}
        </p>

        <SortSelect basePath={basePath} />
      </div>

      <AppliedChips basePath={basePath} />
    </div>
  );
}

/** Shared query-string writer — every control funnels through this. */
function useFacetWriter(basePath: string) {
  const router = useRouter();
  const params = useSearchParams();

  const toggle = useCallback(
    (param: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      const current = next.get(param)?.split(",").filter(Boolean) ?? [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      if (updated.length) next.set(param, updated.join(","));
      else next.delete(param);

      const qs = next.toString();
      router.replace((qs ? `${basePath}?${qs}` : basePath) as RuntimeRoute, { scroll: false });
    },
    [basePath, params, router],
  );

  const selectedIn = useCallback(
    (param: string) => params.get(param)?.split(",").filter(Boolean) ?? [],
    [params],
  );

  return { toggle, selectedIn, params, router };
}

/** Options share one row shape across the popover and the mobile sheet. */
function OptionRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const unavailable = count === 0 && !checked;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={unavailable}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
        unavailable
          ? "cursor-not-allowed text-text-tertiary/60"
          : "hover:bg-surface-sunken",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
          checked ? "border-ink-950 bg-ink-950 text-ink-50" : "border-border-strong",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="flex-1">{label}</span>
      <span className="numeric text-xs text-text-tertiary">{count}</span>
    </button>
  );
}

function FacetPopover({
  group,
  basePath,
  counts,
}: {
  group: (typeof facetGroups)[number];
  basePath: string;
  counts: FacetCounts;
}) {
  const { toggle, selectedIn } = useFacetWriter(basePath);
  const tf = useTranslations("facets");
  const tAttr = useTranslations("attributes");
  const selected = selectedIn(group.param);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors duration-300",
            selected.length
              ? "border-ink-950 bg-ink-950 text-ink-50"
              : "border-border-default bg-surface text-text-secondary hover:border-clay-400 hover:text-text-primary",
          )}
        >
          {tf(group.labelKey)}
          {selected.length ? (
            <span className="numeric text-[11px] opacity-70">{selected.length}</span>
          ) : null}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        {group.options.map((option) => (
          <OptionRow
            key={option.value}
            label={option.ns === "facets" ? tf(option.labelKey) : tAttr(option.labelKey)}
            count={counts[group.param]?.[option.value] ?? 0}
            checked={selected.includes(option.value)}
            onToggle={() => toggle(group.param, option.value)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MobileFilters({
  basePath,
  counts,
  resultCount,
}: {
  basePath: string;
  counts: FacetCounts;
  resultCount: number;
}) {
  const t = useTranslations("plp");
  const tf = useTranslations("facets");
  const tAttr = useTranslations("attributes");
  const { toggle, selectedIn, params } = useFacetWriter(basePath);
  const [open, setOpen] = useState(false);

  const activeCount = facetGroups.reduce(
    (total, group) => total + (params.get(group.param)?.split(",").filter(Boolean).length ?? 0),
    0,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {t("filter")}
          {activeCount > 0 ? (
            <span className="numeric ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-clay-600 text-[10px] font-semibold text-ink-50">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88vh] rounded-t-2xl p-0">
        <SheetHeader className="border-b border-border-subtle px-5 py-4">
          <SheetTitle className="font-display text-lg">{t("filter")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
          {facetGroups.map((group) => (
            <fieldset key={group.param}>
              <legend className="px-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                {tf(group.labelKey)}
              </legend>
              <div className="mt-2">
                {group.options.map((option) => (
                  <OptionRow
                    key={option.value}
                    label={option.ns === "facets" ? tf(option.labelKey) : tAttr(option.labelKey)}
                    count={counts[group.param]?.[option.value] ?? 0}
                    checked={selectedIn(group.param).includes(option.value)}
                    onToggle={() => toggle(group.param, option.value)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border-subtle px-5 py-4">
          <ClearAll basePath={basePath} asButton />
          <Button className="flex-1" onClick={() => setOpen(false)}>
            {t("showResults", { count: resultCount })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AppliedChips({ basePath }: { basePath: string }) {
  const { toggle, params } = useFacetWriter(basePath);
  const tf = useTranslations("facets");
  const tAttr = useTranslations("attributes");

  const applied = facetGroups.flatMap((group) =>
    (params.get(group.param)?.split(",").filter(Boolean) ?? []).map((value) => {
      const option = group.options.find((o) => o.value === value);
      return {
        param: group.param,
        value,
        label: option
          ? option.ns === "facets"
            ? tf(option.labelKey)
            : tAttr(option.labelKey)
          : value,
      };
    }),
  );

  if (!applied.length) return null;

  return (
    <div className="flex flex-wrap gap-2 border-t border-border-subtle py-3">
      {applied.map((chip) => (
        <button
          key={`${chip.param}-${chip.value}`}
          type="button"
          onClick={() => toggle(chip.param, chip.value)}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-sunken pl-3 pr-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function ClearAll({ basePath, asButton = false }: { basePath: string; asButton?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("plp");
  const hasAny = facetGroups.some((group) => params.get(group.param));

  if (!hasAny) return asButton ? <span /> : null;

  const clear = () => {
    const next = new URLSearchParams(params.toString());
    facetGroups.forEach((group) => next.delete(group.param));
    const qs = next.toString();
    router.replace((qs ? `${basePath}?${qs}` : basePath) as RuntimeRoute, { scroll: false });
  };

  if (asButton) {
    return (
      <Button variant="ghost" onClick={clear}>
        {t("clear")}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={clear}
      className="ml-1 text-xs text-clay-700 underline-offset-4 transition-colors hover:underline"
    >
      {t("clearAll")}
    </button>
  );
}

function SortSelect({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("plp");
  const current = (params.get("sort") as SortKey) ?? "featured";

  const onChange = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "featured") next.delete("sort");
    else next.set("sort", value);
    const qs = next.toString();
    router.replace((qs ? `${basePath}?${qs}` : basePath) as RuntimeRoute, { scroll: false });
  };

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label={t("sort")}
        className="w-auto min-w-36 shrink-0 rounded-full border-border-default"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
