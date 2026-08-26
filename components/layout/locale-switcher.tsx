"use client";

import { Check, Globe } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, type Locale, routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * PID v2.0 §9.1
 *
 * Switching locale preserves the current route. Uses the locale-aware router
 * from `@/i18n/navigation` — the plain `next/navigation` router would drop the
 * locale prefix and silently break the switch.
 *
 * Locale names are shown in their own script (简体中文, not "Chinese"), which
 * is the only form a speaker of that language reliably recognises.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error — pathname/params are correlated at runtime but
        // typedRoutes cannot prove it for a dynamic switch.
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60",
          className,
        )}
        aria-label="Change language"
      >
        <Globe className="size-3.5" aria-hidden="true" />
        <span>{LOCALE_LABELS[locale].native}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => switchTo(l)}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>{LOCALE_LABELS[l].native}</span>
            {l === locale ? (
              <Check className="size-3.5 text-clay-700" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
