import { ArrowUpRight, Plus, Search, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { listCategories, listProducts, LOCALES } from "@/lib/admin/catalogue";
import { formatSen } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/href";

export const metadata: Metadata = { title: "Products" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "inactive", label: "Hidden" },
  { key: "untranslated", label: "Missing translations" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const view = (VIEWS.find((v) => v.key === query.view)?.key ?? "all") as ViewKey;
  const search = typeof query.q === "string" ? query.q : "";
  const categoryId = typeof query.category === "string" ? query.category : undefined;

  const [products, categories] = await Promise.all([
    listProducts({ search, state: view, categoryId }),
    listCategories(),
  ]);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, q: search || undefined, category: categoryId, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return adminHref(`/admin/products${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <AdminPage
      title="Products"
      lead="What the shop sells. Prices and copy live on each product; stock lives in Inventory."
      actions={
        <Link
          href={adminHref("/admin/products/new")}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-950 px-3.5 text-[13px] text-ink-50 transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New plant
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={qs({ view: v.key })}
            className={
              v.key === view
                ? "inline-flex h-8 items-center rounded-full border border-ink-950 bg-ink-950 px-3.5 text-[13px] text-ink-50"
                : "inline-flex h-8 items-center rounded-full border border-border-default bg-surface px-3.5 text-[13px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            }
          >
            {v.label}
          </Link>
        ))}

        <form action="/admin/products" className="relative ml-auto">
          <input type="hidden" name="view" value={view} />
          {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Name, ref or botanical name"
            aria-label="Search products"
            className="h-8 w-64 rounded-full border border-border-default bg-surface pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
          />
        </form>
      </div>

      {/* Category filter is separate from the view chips: they answer different
          questions and combining them into one row makes both harder to scan. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={qs({ category: undefined })}
          className={
            !categoryId
              ? "rounded-full border border-ink-950 bg-ink-950 px-2.5 py-1 text-[12px] text-ink-50"
              : "rounded-full border border-border-default px-2.5 py-1 text-[12px] text-text-secondary transition-colors hover:border-border-strong"
          }
        >
          Every category
        </Link>
        {categories
          .filter((c) => !c.isDerived)
          .map((c) => (
            <Link
              key={c.id}
              href={qs({ category: c.id })}
              className={
                categoryId === c.id
                  ? "rounded-full border border-ink-950 bg-ink-950 px-2.5 py-1 text-[12px] text-ink-50"
                  : "rounded-full border border-border-default px-2.5 py-1 text-[12px] text-text-secondary transition-colors hover:border-border-strong"
              }
            >
              {c.name}
            </Link>
          ))}
      </div>

      <AdminCard flush>
        {products.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-text-tertiary">
            {search ? `Nothing matches “${search}”.` : "Nothing in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Locales</th>
                  <th className="px-5 py-3 text-right font-medium">Variants</th>
                  <th className="px-5 py-3 text-right font-medium">From</th>
                  <th className="px-5 py-3 text-right font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">State</th>
                  <th className="w-10 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="group border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-sunken"
                  >
                    <td className="max-w-[18rem] px-5 py-3">
                      <Link
                        href={`/admin/products/${p.ref}`}
                        className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span className="numeric block truncate text-[11px] text-text-tertiary">
                        {p.ref}
                        {p.nameBotanical ? ` · ${p.nameBotanical}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-text-secondary">
                      {p.categoryName ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex gap-1">
                        {LOCALES.map((l) => (
                          <span
                            key={l}
                            title={p.locales.includes(l) ? `${l} present` : `${l} missing`}
                            className={
                              p.locales.includes(l)
                                ? "rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary"
                                : "rounded-sm border border-dashed border-warning/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warning"
                            }
                          >
                            {l}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="numeric px-5 py-3 text-right text-[13px]">{p.variantCount}</td>
                    <td className="numeric px-5 py-3 text-right text-[13px]">
                      {p.priceFromSen === null ? "—" : formatSen(p.priceFromSen)}
                    </td>
                    <td className="numeric px-5 py-3 text-right text-[13px]">
                      {p.onHand === 0 ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <TriangleAlert className="size-3.5" aria-hidden="true" />0
                        </span>
                      ) : (
                        p.onHand
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary">
                          <span className="size-1.5 rounded-full bg-border-strong" aria-hidden="true" />
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/products/${p.ref}`}
                        aria-label={`Open ${p.name}`}
                        className="flex size-7 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
