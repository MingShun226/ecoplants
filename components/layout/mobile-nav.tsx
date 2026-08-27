"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/logo";
import { LeafRule } from "@/components/brand/primitives";
import { SheetClose } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

/**
 * Every link is wrapped in `SheetClose`, which is what actually dismisses the
 * drawer on tap. Radix owns the open state, so closing through its own control
 * beats a pathname effect: no extra render pass, and it still works for a link
 * to the page you are already on, where the pathname never changes and an
 * effect would leave the drawer sitting open over the page.
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
              <SheetClose asChild>
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
              </SheetClose>
            </li>
          ))}
        </ul>

        <LeafRule className="my-5" />

        <ul className="flex flex-col gap-1">
          {secondary.map((item) => (
            <li key={item.href}>
              <SheetClose asChild>
                <Link
                  href={item.href}
                  className="block py-2.5 text-sm text-text-secondary"
                >
                  {item.label}
                </Link>
              </SheetClose>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
