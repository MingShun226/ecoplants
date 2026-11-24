import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { NewPartnerForm } from "@/components/admin/partner-forms";

export const metadata: Metadata = { title: "Add nursery" };

/**
 * Adding a nursery asks only for who it is and how to reach it. Where it is,
 * when it opens, what it stocks and where it is paid all follow on the next
 * screen, which is built for them — and a new nursery starts as Onboarding, so
 * nothing half-filled-in can be given an order.
 */
export default function NewPartnerPage() {
  return (
    <AdminPage
      title="Add nursery"
      lead="Who they are and how to reach them. Location, pickup hours and plants come next."
    >
      <Link
        href="/admin/partners"
        className="-mt-2 inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All nurseries
      </Link>
      <AdminCard>
        <NewPartnerForm />
      </AdminCard>
    </AdminPage>
  );
}
