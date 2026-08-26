"use client";

import { Search, ShoppingBag, User, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartDrawer } from "@/components/features/cart-drawer";
import { onOpenCartDrawer, useCart } from "@/components/features/cart-provider";
import { Link } from "@/i18n/navigation";
import { toMajor } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * A single searchable row per plant, built on the server so the client never
 * ships the catalogue twice.
 */
export interface SearchEntry {
  id: string;
  name: string;
  botanical: string;
  slug: string;
  meta: string;
  fromSen: number;
  /** Every locale's name plus attribute words, lowercased, for matching. */
  haystack: string;
}

/**
 * Header actions: search and basket.
 *
 * The search icon grows into a field in place rather than opening an overlay or
 * navigating to a results page. That keeps the header a single continuous
 * object — the icon becomes the left edge of the input, so nothing appears from
 * nowhere. Width is the only animated property, which is why it can run at
 * 450ms without feeling slow.
 *
 * Results drop straight into a panel under the field. For a catalogue this size
 * a dedicated results page is a wasted navigation: you can see everything that
 * matches before you finish typing.
 */
export function HeaderActions({ index }: { index: readonly SearchEntry[] }) {
  const t = useTranslations("nav");
  const ts = useTranslations("search");
  const tAccount = useTranslations("account");
  const ta = useTranslations("actions");
  const format = useFormatter();
  const { count } = useCart();

  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onOpenCartDrawer(() => setCartOpen(true));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Collapse on outside click or Escape — an expanded field that stays open
  // after you look away reads as broken.
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeSearch();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, closeSearch]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return index.filter((entry) => terms.every((term) => entry.haystack.includes(term))).slice(0, 6);
  }, [index, query]);

  const trimmed = query.trim();

  return (
    <>
      <div className="flex items-center gap-0.5" ref={wrapRef}>
        <div className="relative flex items-center">
          {/* Width is the only animated property, which is why it can run at
              450ms without feeling slow. Driven by CSS rather than by a measured
              pixel value: min() sizes it against the viewport with no resize
              listener and no state. */}
          <div
            className={cn(
              "flex h-10 items-center overflow-hidden rounded-full",
              "transition-[width,background-color,border-color] duration-[450ms] ease-refined",
              searchOpen
                ? "w-[min(16rem,calc(100vw-13rem))] border border-current/20 bg-current/[0.06]"
                : "w-10 border border-transparent",
            )}
          >
            <button
              type="button"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              aria-label={t("search")}
              aria-expanded={searchOpen}
              className="flex size-10 shrink-0 items-center justify-center rounded-full opacity-75 transition-opacity hover:opacity-100"
            >
              {searchOpen ? (
                <X className="size-[18px]" aria-hidden="true" />
              ) : (
                <Search className="size-[18px]" aria-hidden="true" />
              )}
            </button>

            <AnimatePresence>
              {searchOpen ? (
                <m.input
                  ref={inputRef}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: 0.12 }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={ts("placeholder")}
                  aria-label={t("search")}
                  type="search"
                  autoComplete="off"
                  className="h-full w-full min-w-0 bg-transparent pr-3 text-[13px] outline-none placeholder:opacity-50"
                />
              ) : null}
            </AnimatePresence>
          </div>

          {/* The results panel is anchored to the field, not the viewport, so it
              stays attached while the field animates open. */}
          <AnimatePresence>
            {searchOpen && trimmed ? (
              <m.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border-subtle bg-canvas text-text-primary shadow-overlay"
              >
                {results.length > 0 ? (
                  <ul>
                    {results.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`/plants/${entry.slug}`}
                          onClick={closeSearch}
                          className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-sunken"
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-[14.5px]">{entry.name}</span>
                            <span className="truncate text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
                              {entry.meta}
                            </span>
                          </span>
                          <span className="numeric shrink-0 text-[13px] font-medium">
                            {format.number(toMajor(entry.fromSen), "currency")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-text-secondary">
                    {ts("emptyTitle")}
                  </p>
                )}
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/*
          Always links to /account, which redirects to /login when nobody is
          signed in. Reading the session here instead would mean calling
          cookies() in the header — and the header is in the storefront layout,
          so that would opt all 42 prerendered product pages out of static
          rendering to decide which of two icons to draw.
        */}
        <Link
          href="/account"
          aria-label={tAccount("myAccount")}
          className="flex size-10 items-center justify-center rounded-full opacity-75 transition-all duration-300 hover:bg-current/10 hover:opacity-100"
        >
          <User className="size-[18px]" aria-hidden="true" />
        </Link>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={t("cart")}
          className="flex size-10 items-center justify-center rounded-full opacity-75 transition-all duration-300 hover:bg-current/10 hover:opacity-100"
        >
          <span className="relative">
            <ShoppingBag className="size-[18px]" aria-hidden="true" />
            {count > 0 ? (
              <span className="numeric absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-clay-600 text-[9px] font-medium text-ink-50">
                {count}
              </span>
            ) : null}
          </span>
          <span className="sr-only">{ta("itemsInCart", { count })}</span>
        </button>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
