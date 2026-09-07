"use client";

import { Loader2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import {
  resolveAddress,
  suggestAddresses,
  type AddressSuggestion,
} from "@/lib/checkout/places-actions";
import type { ResolvedAddress } from "@/lib/checkout/places-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The street line, with Google's suggestions underneath it.
 *
 * A combobox rather than Google's own widget: the key stays on our server (see
 * `places-actions.ts`), and the list is our own markup, so it takes the shop's
 * type and colours instead of arriving in an iframe that ignores them.
 *
 * Everything still works with the suggestions switched off. It is a plain text
 * input that happens to offer completions — a shopper can ignore the list, type
 * a kampung address Google has never heard of, and submit. That matters here
 * more than in most shops: Google's Malaysian coverage is good in the Klang
 * Valley and patchy off it, and an address it cannot find is not a bad address.
 */
export function AddressField({
  id,
  label,
  hint,
  defaultValue,
  onResolved,
}: {
  id: string;
  label: string;
  hint: string;
  defaultValue?: string;
  /** Fires when a suggestion is chosen, with the parts to fill in below. */
  onResolved: (address: ResolvedAddress) => void;
}) {
  const t = useTranslations("checkout");
  const listId = useId();

  const [value, setValue] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);

  /**
   * One token for one address entry.
   *
   * Google bills a run of keystrokes plus the detail fetch that follows as a
   * single session when they share a token. A new one is minted after each
   * chosen address, because that ends the session.
   */
  const session = useRef(crypto.randomUUID());

  /** The last query actually sent, so a stale reply cannot overwrite a newer one. */
  const latest = useRef("");

  /** Too short to ask about, so nothing from a previous query is shown either. */
  const askable = value.trim().length >= 3;

  /*
   * Debounced: a request per keystroke would be billable noise, and the list
   * flickering under the cursor is worse than a beat of delay.
   *
   * Every state change happens inside the timeout rather than in the effect
   * body. Clearing the list synchronously when the query got too short was the
   * obvious way to write it and causes a second render pass on every keystroke;
   * `askable` above does the same job during render instead.
   */
  useEffect(() => {
    const query = value.trim();
    latest.current = query;
    if (query.length < 3) return;

    const timer = window.setTimeout(async () => {
      setBusy(true);
      const found = await suggestAddresses(query, session.current);
      // Typed on since. Whatever came back is for a query nobody is looking at.
      if (latest.current !== query) return;
      setSuggestions(found);
      setActive(-1);
      setBusy(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [value]);

  const choose = async (suggestion: AddressSuggestion) => {
    setOpen(false);
    setSuggestions([]);
    setBusy(true);

    const resolved = await resolveAddress(suggestion.placeId, session.current);
    session.current = crypto.randomUUID();
    setBusy(false);

    // Google names the street; it does not know the unit number. Keep what it
    // found and let the shopper add the rest in front of it.
    setValue(resolved?.line1 || suggestion.main);
    if (resolved) onResolved(resolved);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + suggestions.length) % suggestions.length;
      });
    }
    if (e.key === "Enter" && active >= 0) {
      // Only when something is highlighted, so Enter still submits the form for
      // a shopper who typed their address out and never touched the list.
      e.preventDefault();
      void choose(suggestions[active]);
    }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="relative">
        <Input
          id={id}
          name={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          // A beat, so a click on a suggestion lands before the list closes.
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onFocus={() => setOpen(true)}
          autoComplete="address-line1"
          required
          role="combobox"
          aria-expanded={open && askable && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="rounded-sm pr-9"
        />
        {busy && askable ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-tertiary motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-text-tertiary">{hint}</p>

      {open && askable && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[4.4rem] z-20 overflow-hidden rounded-lg border border-border-default bg-surface shadow-card"
        >
          {suggestions.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                // `onMouseDown`, not `onClick`: the input's blur fires first
                // otherwise and the list is gone before the click lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  void choose(s);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors",
                  i === active ? "bg-surface-sunken" : "bg-transparent",
                )}
              >
                <MapPin
                  className="mt-0.5 size-3.5 shrink-0 text-text-tertiary"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{s.main}</span>
                  <span className="block truncate text-[11px] text-text-tertiary">
                    {s.secondary}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-border-subtle px-3.5 py-1.5 text-[10px] text-text-tertiary">
            {t("addressPoweredBy")}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
