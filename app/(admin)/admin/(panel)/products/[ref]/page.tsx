import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, AdminField, AdminPage } from "@/components/admin/admin-page";
import {
  AttributesForm,
  ProductFactsForm,
  TranslationEditor,
  VisibilityToggle,
} from "@/components/admin/product-forms";
import { ImageManager } from "@/components/admin/image-manager";
import { NewArrivalControl } from "@/components/admin/misc-forms";
import { VariantEditor } from "@/components/admin/variant-editor";
import { getProduct, listCategories } from "@/lib/admin/catalogue";
import { formatSen } from "@/lib/admin/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  const product = await getProduct(ref);
  return { title: product?.name ?? ref };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const [product, categories] = await Promise.all([getProduct(ref), listCategories()]);
  if (!product) notFound();

  const englishSlug = product.translations.find((t) => t.locale === "en")?.slug;

  return (
    <AdminPage
      title={product.name}
      lead={`${product.ref}${product.nameBotanical ? ` · ${product.nameBotanical}` : ""}`}
      actions={
        <>
          {product.isActive && englishSlug ? (
            <a
              href={`/en/plants/${englishSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default px-3.5 text-[13px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              View in shop
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <VisibilityToggle productId={product.id} isActive={product.isActive} />
        </>
      }
    >
      <Link
        href="/admin/products"
        className="-mt-2 inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All products
      </Link>

      {!product.isActive ? (
        <div className="rounded-lg border border-border-default bg-surface-sunken px-5 py-4 text-sm leading-relaxed">
          <strong className="font-medium">Hidden from the shop.</strong> Nobody can
          find or buy this. Everything below can still be edited.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <AdminCard
            title="Copy"
            lead="English is the source. Malay and Chinese fall back to it where they are missing."
          >
            <TranslationEditor product={product} />
          </AdminCard>

          <AdminCard
            title="Photos"
            lead="The primary photo is the card image. Without one the shop draws generated artwork instead."
          >
            <ImageManager
              productId={product.id}
              productRef={product.ref}
              productName={product.name}
              images={product.images}
              variants={product.variants}
            />
          </AdminCard>

          <AdminCard title="Variants, prices and stock" flush>
            {product.variants.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-text-tertiary">
                No variants. Nothing can be bought until there is at least one.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {product.variants.map((v) => (
                  <VariantEditor key={v.id} variant={v} productName={product.name} />
                ))}
              </ul>
            )}
            <p className="border-t border-border-subtle px-5 py-3 text-[11px] leading-relaxed text-text-tertiary">
              Adding or removing a variant is not possible here yet — a variant carries a
              SKU, an inventory row and price snapshots on historical orders, and getting
              that wrong breaks orders that already reference it. Everything about an
              existing one, stock included, is editable above.
            </p>
          </AdminCard>

          <AdminCard
            title="Care attributes"
            lead="These drive the filters, the quiz and the care panel on the product page."
          >
            <AttributesForm productId={product.id} attributes={product.attributes} />
          </AdminCard>
        </div>

        <div className="flex flex-col gap-6">
          <AdminCard
            title="Classification"
            lead="What this plant is and where it sits in the shop. Not translated."
          >
            <ProductFactsForm product={product} categories={categories} />
          </AdminCard>

          <AdminCard
            title="New arrival"
            lead="Puts this on the New arrivals page and badges its card."
          >
            <NewArrivalControl productId={product.id} daysLeft={product.newArrivalDaysLeft} />
          </AdminCard>

          <AdminCard title="At a glance">
            <dl className="flex flex-col gap-4">
              <AdminField label="In stock">
                <span className="numeric">{product.onHand}</span>
              </AdminField>
              <AdminField label="Price from">
                <span className="numeric">
                  {product.priceFromSen === null ? "—" : formatSen(product.priceFromSen)}
                </span>
              </AdminField>
              <AdminField label="Reviews">
                {/* Ratings come from approved reviews and nothing else. Until
                    one exists this says so, rather than showing a number that
                    could only have been invented. */}
                {product.reviewCount === 0 || product.rating === null ? (
                  <span className="text-text-tertiary">None yet</span>
                ) : (
                  <Link href="/admin/reviews" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                    <Star className="size-3.5 fill-current" aria-hidden="true" />
                    <span className="numeric">{product.rating.toFixed(1)}</span>
                    <span className="numeric text-text-tertiary">({product.reviewCount})</span>
                  </Link>
                )}
              </AdminField>
            </dl>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
