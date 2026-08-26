import { BadgeCheck, ImageIcon, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { ReviewControls } from "@/components/admin/misc-forms";
import { listReviews } from "@/lib/admin/people";
import { formatWhen } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Reviews" };

const VIEWS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Published" },
  { key: "all", label: "All" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const view = (VIEWS.find((v) => v.key === query.view)?.key ?? "pending") as ViewKey;
  const reviews = await listReviews({ view });

  return (
    <AdminPage
      title="Reviews"
      lead="Nothing appears on the storefront until it is published here."
    >
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/reviews?view=${v.key}`}
            className={
              v.key === view
                ? "inline-flex h-8 items-center rounded-full border border-ink-950 bg-ink-950 px-3.5 text-[13px] text-ink-50"
                : "inline-flex h-8 items-center rounded-full border border-border-default bg-surface px-3.5 text-[13px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            }
          >
            {v.label}
          </Link>
        ))}
      </div>

      <AdminCard flush>
        {reviews.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-text-tertiary">
            {view === "pending"
              ? "Nothing waiting. That is the good outcome."
              : "No reviews here."}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={
                            n <= r.rating
                              ? "size-3.5 fill-current text-text-primary"
                              : "size-3.5 text-border-strong"
                          }
                          aria-hidden="true"
                        />
                      ))}
                    </span>

                    <Link
                      href={`/admin/products/${r.productRef}`}
                      className="text-[13px] font-medium underline-offset-4 hover:underline"
                    >
                      {r.productName}
                    </Link>

                    {/* A review tied to an order is a verified purchase, which is
                        the single most useful thing a moderator can know. */}
                    {r.orderNo ? (
                      <Link
                        href={`/admin/orders/${r.orderNo}`}
                        className="inline-flex items-center gap-1 rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary"
                      >
                        <BadgeCheck className="size-2.5" aria-hidden="true" />
                        verified · {r.orderNo}
                      </Link>
                    ) : (
                      <span className="rounded-sm border border-dashed border-warning/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warning">
                        no order attached
                      </span>
                    )}

                    {r.imageCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                        <ImageIcon className="size-3" aria-hidden="true" />
                        {r.imageCount}
                      </span>
                    ) : null}

                    <span className="text-[11px] text-text-tertiary">{formatWhen(r.createdAt)}</span>

                    {r.isApproved ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
                        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                        Live
                      </span>
                    ) : null}
                  </div>

                  {r.body ? (
                    <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
                      {r.body}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] italic text-text-tertiary">
                      Rating only, no written review.
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  <ReviewControls reviewId={r.id} isApproved={r.isApproved} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <p className="text-[12px] leading-relaxed text-text-tertiary">
        Customers cannot submit reviews yet — there is no account area and no
        post-purchase prompt, so this queue stays empty until one exists. The moderation
        gate is built and enforced at the database, so it is ready when they can.
      </p>
    </AdminPage>
  );
}
