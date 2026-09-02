import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { NewProductForm } from "@/components/admin/new-product-form";
import { listCategories } from "@/lib/admin/catalogue";

export const metadata: Metadata = { title: "New product" };

/**
 * A static segment beside `[ref]`, which Next resolves in favour of the literal
 * — so this is `/admin/products/new`, not a product whose reference is "new".
 */
export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <AdminPage
      title="New plant"
      lead="The few things that cannot be guessed. Everything else is edited on its own screen afterwards."
    >
      <Link
        href="/admin/products"
        className="-mt-2 inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All products
      </Link>

      <AdminCard className="max-w-3xl">
        <NewProductForm categories={categories} />
      </AdminCard>
    </AdminPage>
  );
}
