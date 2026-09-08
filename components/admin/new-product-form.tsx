"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProduct } from "@/lib/admin/catalogue-actions";
import type { CategoryRow } from "@/lib/admin/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Adding a plant.
 *
 * Three fields, and one of them fills itself in. This asks only for what has no
 * sensible default and would be wrong to guess — what it is called, what it
 * costs, how many there are — then hands over to the detail page, which is
 * already built for the rest.
 *
 * Sizes are not among them any more either. The first one used to be created
 * here, on the reasoning that a plant with no size cannot be bought — true, and
 * it put a SKU, a price and a stock count in front of someone whose next act is
 * to go and photograph the plant. It arrives with no sizes and the next screen
 * says so, which is the same information without the form.
 *
 * Neither the internal reference nor the botanical name is among them. The ref
 * is derived from the name on the server and never shown to anyone; the
 * botanical name falls back to the English one and is edited on the detail page
 * beside the translations, which is where someone has the plant's papers to
 * hand. The web address still derives from the name as it is typed, and stops
 * deriving the moment it is edited by hand: auto-filling a field someone has
 * already corrected is worse than never filling it at all.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function NewProductForm({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * Only the categories a plant can actually be filed under.
   *
   * "New arrivals", "Pet-safe" and "Beginner" are derived — membership follows
   * from `new_until` and the care attributes, not from an assignment. They are
   * therefore not offered here, and must not be the default either: the first
   * category by position is "New arrivals", so seeding the field from the
   * unfiltered list picked a value the dropdown never showed, and filed the
   * plant somewhere no shopper browses.
   */
  const assignable = categories.filter((c) => !c.isDerived);

  const [f, setF] = useState({
    name: "",
    slug: "",
    categoryId: assignable[0]?.id ?? "",
  });

  // Once it has been typed into, it belongs to the operator.
  const [slugTouched, setSlugTouched] = useState(false);

  const setName = (name: string) =>
    setF((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : slugify(name),
    }));

  const ready = f.name.trim() !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createProduct({
            categoryId: f.categoryId,
            name: f.name,
            slug: f.slug,
          });

          if (result.ok) {
            // Straight to the plant's own screen, where the photographs go.
            router.push(`/admin/products/${result.ref}`);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Name in English</Label>
          <Input
            id="name"
            value={f.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aglaonema Red"
            required
            autoFocus
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            Malay and Chinese are added afterwards. Until they exist, both fall back to this.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}>
            <SelectTrigger id="categoryId" className="h-8 rounded-sm text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignable.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">Web address</Label>
          <Input
            id="slug"
            value={f.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setF({ ...f, slug: e.target.value });
            }}
            required
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="truncate text-[11px] text-text-tertiary">/en/plants/{f.slug || "…"}</p>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
        <Button type="submit" size="sm" disabled={pending || !ready}>
          {pending ? "Creating…" : "Create, then add sizes and photos"}
        </Button>
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          It arrives hidden, with no sizes. Add photographs and at least one size on the
          next screen, then publish it.
        </p>
      </div>
    </form>
  );
}
