import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import {
  CategoryCopyForm,
  CategoryImageForm,
  CategoryOrderControls,
} from "@/components/admin/misc-forms";
import { listCategories, LOCALES } from "@/lib/admin/catalogue";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <AdminPage
      title="Categories"
      lead="The order here is the order they appear in the shop's navigation and footer."
    >
      <AdminCard flush>
        <ul className="divide-y divide-border-subtle">
          {categories.map((c, i) => (
            <li key={c.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start">
              <div className="flex shrink-0 items-start gap-3">
                <CategoryOrderControls
                  categoryId={c.id}
                  isFirst={i === 0}
                  isLast={i === categories.length - 1}
                />
                <div className="min-w-0 lg:w-56">
                  <p className="text-[13px] font-medium">{c.name}</p>
                  <p className="numeric text-[11px] text-text-tertiary">/{c.slug}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary">
                      {c.kind}
                    </span>
                    {c.isDerived ? (
                      <span
                        title="Membership is computed from plant attributes, not assigned"
                        className="inline-flex items-center gap-1 rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary"
                      >
                        <Sparkles className="size-2.5" aria-hidden="true" />
                        derived
                      </span>
                    ) : (
                      <Link
                        href={`/admin/products?category=${c.id}`}
                        className="numeric text-[11px] text-text-tertiary underline-offset-2 hover:underline"
                      >
                        {c.productCount} {c.productCount === 1 ? "product" : "products"}
                      </Link>
                    )}
                    {c.translations.length < LOCALES.length ? (
                      <span className="rounded-sm border border-dashed border-warning/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warning">
                        {LOCALES.length - c.translations.length} missing
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-5">
                <CategoryImageForm
                  categoryId={c.id}
                  slug={c.slug}
                  name={c.name}
                  src={c.imageSrc}
                />
                <CategoryCopyForm categoryId={c.id} translations={c.translations} />
              </div>
            </li>
          ))}
        </ul>
      </AdminCard>

      <p className="text-[12px] leading-relaxed text-text-tertiary">
        Categories cannot be created or deleted here. A slug is baked into URLs, the
        footer and the navigation, so adding one is a code change as much as a data
        change — and deleting one orphans every product pointing at it. A derived
        category like “pet safe” has no products assigned at all: membership is computed
        from plant attributes, which is why its count is blank.
      </p>
    </AdminPage>
  );
}
