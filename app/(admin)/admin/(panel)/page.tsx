import { ArrowUpRight, PackageSearch, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { getDashboard } from "@/lib/admin/dashboard";
import { getSettings } from "@/lib/admin/settings";
import { formatSen, formatWhen } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/href";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const settings = await getSettings();
  const d = await getDashboard(settings.lowStockThreshold);

  const change =
    d.revenue.prev7Sen > 0
      ? Math.round(((d.revenue.last7Sen - d.revenue.prev7Sen) / d.revenue.prev7Sen) * 100)
      : null;

  return (
    <AdminPage
      title="Overview"
      lead="What needs doing, what is running out, and how trade is going."
    >
      {/* Work first. A dashboard that opens with a revenue chart is a dashboard
          for the owner; this one opens with the queue, for whoever is packing. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Needs packing"
          value={d.needsPacking}
          href="/admin/orders?view=actionable"
          urgent={d.needsPacking > 0}
        />
        <Stat label="Awaiting payment" value={d.awaitingPayment} href="/admin/orders?view=pending" />
        <Stat label="In transit" value={d.inTransit} href="/admin/orders?view=shipped" />
        <Stat
          label="Reviews to moderate"
          value={d.unmoderatedReviews}
          href="/admin/reviews?view=pending"
          urgent={d.unmoderatedReviews > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <AdminCard
            title="Trade"
            lead="Paid orders only — cancelled and refunded are not revenue."
          >
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
                  Last 7 days
                </p>
                <p className="numeric mt-1 text-2xl tracking-tight">{formatSen(d.revenue.last7Sen)}</p>
                {change !== null ? (
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${
                      change >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {change >= 0 ? (
                      <TrendingUp className="size-3.5" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="size-3.5" aria-hidden="true" />
                    )}
                    {change >= 0 ? "+" : ""}
                    {change}% on the week before
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-text-tertiary">No trade the week before</p>
                )}
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
                  Orders, last 7 days
                </p>
                <p className="numeric mt-1 text-2xl tracking-tight">{d.revenue.ordersLast7}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
                  Last 30 days
                </p>
                <p className="numeric mt-1 text-2xl tracking-tight">{formatSen(d.revenue.last30Sen)}</p>
              </div>
            </div>
          </AdminCard>

          <AdminCard
            title="Selling"
            lead="Last 30 days, ranked by what they brought in rather than units shifted."
            flush
          >
            {d.topSellers.length === 0 ? (
              <Empty>Nothing has sold yet.</Empty>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {d.topSellers.map((s) => (
                  <li key={s.sku} className="flex items-center gap-4 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{s.productName}</span>
                      <span className="numeric block text-[11px] text-text-tertiary">{s.sku}</span>
                    </span>
                    <span className="numeric shrink-0 text-[13px] text-text-secondary">
                      {s.units} sold
                    </span>
                    <span className="numeric w-24 shrink-0 text-right text-[13px] font-medium">
                      {formatSen(s.revenueSen)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Latest orders" flush>
            {d.recentOrders.length === 0 ? (
              <Empty>No orders yet.</Empty>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {d.recentOrders.map((o) => (
                  <li key={o.orderNo}>
                    <Link
                      href={`/admin/orders/${o.orderNo}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-sunken"
                    >
                      <span className="numeric w-28 shrink-0 text-[13px] font-medium">{o.orderNo}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{o.fullName}</span>
                      <OrderStatusBadge status={o.status} />
                      <span className="numeric w-20 shrink-0 text-right text-[13px]">
                        {formatSen(o.totalSen)}
                      </span>
                      <span className="numeric hidden w-16 shrink-0 text-right text-[11px] text-text-tertiary sm:block">
                        {formatWhen(o.placedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <div className="flex flex-col gap-6">
          <AdminCard
            title="Running low"
            lead={`At or below ${settings.lowStockThreshold} available.`}
            flush
            actions={
              <Link
                href="/admin/inventory?view=low"
                className="text-xs text-text-tertiary transition-colors hover:text-text-primary"
              >
                All stock
              </Link>
            }
          >
            {d.outOfStock > 0 ? (
              <Link
                href="/admin/inventory?view=out"
                className="flex items-center gap-2 border-b border-border-subtle bg-danger-soft px-5 py-3 text-[13px] transition-opacity hover:opacity-80"
              >
                <PackageSearch className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-medium">{d.outOfStock}</strong>{" "}
                  {d.outOfStock === 1 ? "SKU is" : "SKUs are"} out of stock
                </span>
              </Link>
            ) : null}

            {d.lowStock.length === 0 ? (
              <Empty>Nothing is running low.</Empty>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {d.lowStock.map((s) => (
                  <li key={s.sku} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{s.productName}</span>
                      <span className="numeric block text-[11px] text-text-tertiary">{s.sku}</span>
                    </span>
                    <span className="numeric shrink-0 text-[13px] font-medium text-warning">
                      {s.available}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}

function Stat({
  label,
  value,
  href,
  urgent = false,
}: {
  label: string;
  value: number;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={adminHref(href)}
      className={`group flex flex-col gap-1 rounded-xl border bg-surface px-5 py-4 transition-colors ${
        urgent ? "border-warning/40 hover:border-warning" : "border-border-subtle hover:border-border-strong"
      }`}
    >
      <span className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">
        {label}
        <ArrowUpRight
          className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </span>
      <span className="numeric text-2xl tracking-tight">{value}</span>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-text-tertiary">{children}</p>;
}
