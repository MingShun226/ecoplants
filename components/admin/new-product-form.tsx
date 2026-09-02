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
 * Nine fields, and three of them fill themselves in. This asks only for what
 * has no sensible default and would be wrong to guess — what it is called, what
 * it costs, how many there are — then hands over to the detail page, which is
 * already built for the rest.
 *
 * The reference and the web address derive from the name as it is typed, and
 * stop deriving the moment either is edited by hand. Auto-filling a field
 * someone has already corrected is worse than never filling it at all.
 */
const SIZES = ["small", "medium", "large", "extra-large"];

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
    ref: "",
    slug: "",
    nameBotanical: "",
    categoryId: assignable[0]?.id ?? "",
    sizeKey: "medium",
    sku: "",
    price: "",
    stock: "0",
  });

  // Once either has been typed into, it belongs to the operator.
  const [touched, setTouched] = useState({ ref: false, slug: false });

  const setName = (name: string) =>
    setF((prev) => ({
      ...prev,
      name,
      ref: touched.ref ? prev.ref : slugify(name),
      slug: touched.slug ? prev.slug : slugify(name),
    }));

  const ready = f.name.trim() !== "" && f.sku.trim() !== "" && Number(f.price) > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createProduct({
            ref: f.ref,
            nameBotanical: f.nameBotanical,
            categoryId: f.categoryId,
            name: f.name,
            slug: f.slug,
            sizeKey: f.sizeKey,
            sku: f.sku,
            priceSen: Math.round(Number(f.price) * 100),
            quantityOnHand: Math.round(Number(f.stock) || 0),
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
          <Label htmlFor="nameBotanical">Botanical name</Label>
          <Input
            id="nameBotanical"
            value={f.nameBotanical}
            onChange={(e) => setF({ ...f, nameBotanical: e.target.value })}
            placeholder="Aglaonema commutatum"
            className="h-8 rounded-sm text-[13px]"
          />
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
              setTouched({ ...touched, slug: true });
              setF({ ...f, slug: e.target.value });
            }}
            required
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="truncate text-[11px] text-text-tertiary">/en/plants/{f.slug || "…"}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ref">Reference</Label>
          <Input
            id="ref"
            value={f.ref}
            onChange={(e) => {
              setTouched({ ...touched, ref: true });
              setF({ ...f, ref: e.target.value });
            }}
            required
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            Internal. Never shown to a shopper, and never changes.
          </p>
        </div>
      </div>

      {/* A product with no variant cannot be bought, so the first one is part of
          creating the plant rather than a second job to remember. */}
      <div className="flex flex-col gap-4 border-t border-border-subtle pt-5">
        <div>
          <h3 className="text-[13px] font-medium">The first size</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-tertiary">
            Nothing can be bought until a plant has one. Pot, weight and dimensions get
            sensible defaults you can correct afterwards.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sizeKey">Size</Label>
            <Select value={f.sizeKey} onValueChange={(v) => setF({ ...f, sizeKey: v })}>
              <SelectTrigger id="sizeKey" className="h-8 rounded-sm text-[13px] capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={f.sku}
              onChange={(e) => setF({ ...f, sku: e.target.value })}
              placeholder="AGL-COM-M-CHA"
              required
              className="numeric h-8 rounded-sm text-[13px] uppercase"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Price (RM)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value })}
              required
              className="numeric h-8 rounded-sm text-[13px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="stock">In stock</Label>
            <Input
              id="stock"
              type="number"
              min="0"
              value={f.stock}
              onChange={(e) => setF({ ...f, stock: e.target.value })}
              required
              className="numeric h-8 rounded-sm text-[13px]"
            />
          </div>
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
          {pending ? "Creating…" : "Create, then add photos"}
        </Button>
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          It arrives hidden from the shop. Publish it once it has photographs.
        </p>
      </div>
    </form>
  );
}
