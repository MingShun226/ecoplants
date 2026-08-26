"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/logo";
import { LeafRule } from "@/components/brand/primitives";
import { Link } from "@/i18n/navigation";

/**
 * The drawer closes from its own links' onClick rather than from a pathname
 * effect — setState inside an effect costs an extra render pass, and Radix's
 * Sheet already owns the open state.
 */
export function MobileNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const t = useTranslations("nav");

  const secondary = [
    { href: "/quiz", label: t("quiz") },
    { href: "/guarantee", label: t("guarantee") },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Wordmark className="h-7 w-auto text-text-primary" />
      </div>

      <LeafRule className="mx-5 w-auto" />

      <nav className="flex-1 overflow-y-auto px-5 py-6">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center justify-between py-3 font-display text-xl"
              >
                {item.label}
                <ArrowUpRight
                  className="size-4 text-clay-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>

        <LeafRule className="my-5" />

        <ul className="flex flex-col gap-1">
          {secondary.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block py-2.5 text-sm text-text-secondary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
