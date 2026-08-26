import { ArrowUpRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { OrderStatusBadge, PaymentBadge } from "@/components/admin/order-status-badge";
import {
  ACTIONABLE,
  countByStatus,
  listOrders,
  type OrderStatus,
} from "@/lib/admin/orders";
import { formatSen, formatWhen } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Orders" };

/**
 * Views, not a raw status filter.
 *
 * "Actionable" is the default because it is the question the screen exists to
 * answer: what has been paid for and not yet shipped. A status dropdown makes
 * the operator work that out themselves every time they open the page.
 */
const VIEWS = [
  { key: "actionable", label: "Needs packing", statuses: ACTIONABLE },
  { key: "pending", label: "Awaiting payment", statuses: ["pending"] as OrderStatus[] },
  { key: "shipped", label: "In transit", statuses: ["shipped"] as OrderStatus[] },
  { key: "closed", label: "Closed", statuses: ["delivered", "cancelled", "refunded"] as OrderStatus[] },
  { key: "all", label: "All", statuses: undefined },
] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const viewKey = typeof query.view === "string" ? query.view : "actionable";
  const search = typeof query.q === "string" ? query.q : "";

  const view = VIEWS.find((v) => v.key === viewKey) ?? VIEWS[0];
  const [orders, counts] = await Promise.all([
    listOrders({ status: view.statuses ? [...view.statuses] : undefined, search }),
    countByStatus(),
  ]);

  const countFor = (statuses: readonly OrderStatus[] | undefined) =>
    statuses
      ? statuses.reduce((n, s) => n + counts[s], 0)
      : Object.values(counts).reduce((n, c) => n + c, 0);

  return (
    <AdminPage
      title="Orders"
      lead="Paid orders first. Live plants do not wait for a decision, so anything unpacked is at the top."
    >
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const active = v.key === view.key;
          const n = countFor(v.statuses);
          return (
            <Link
              key={v.key}
              href={`/admin/orders?view=${v.key}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className={
                active
                  ? "inline-flex h-8 items-center gap-2 rounded-full border border-ink-950 bg-ink-950 px-3.5 text-[13px] text-ink-50"
                  : "inline-flex h-8 items-center gap-2 rounded-full border border-border-default bg-surface px-3.5 text-[13px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              }
            >
              {v.label}
              <span className={active ? "numeric opacity-70" : "numeric text-text-tertiary"}>{n}</span>
            </Link>
          );
        })}

        <form action="/admin/orders" className="relative ml-auto">
          <input type="hidden" name="view" value={view.key} />
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Order no, name, email or phone"
            aria-label="Search orders"
            className="h-8 w-64 rounded-full border border-border-default bg-surface pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
          />
        </form>
      </div>

      <AdminCard flush>
        {orders.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-text-tertiary">
            {search
              ? `Nothing matches “${search}”.`
              : "Nothing in this view. That is the good outcome."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 text-right font-medium">Items</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Placed</th>
                  <th className="w-10 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="group border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface-sunken"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNo}`}
                        className="numeric text-[13px] font-medium underline-offset-4 hover:underline"
                      >
                        {order.orderNo}
                      </Link>
                      {order.isEastMalaysia ? (
                        <span className="mt-0.5 block text-[10.5px] uppercase tracking-[0.14em] text-warning">
                          East Malaysia
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] px-5 py-3">
                      <span className="block truncate text-[13px]">{order.fullName}</span>
                      <span className="block truncate text-[11px] text-text-tertiary">
                        {order.email}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3">
                      <PaymentBadge status={order.paymentStatus} />
                    </td>
                    <td className="numeric px-5 py-3 text-right text-[13px]">{order.itemCount}</td>
                    <td className="numeric px-5 py-3 text-right text-[13px] font-medium">
                      {formatSen(order.totalSen)}
                    </td>
                    <td className="numeric px-5 py-3 text-[12px] text-text-tertiary">
                      {formatWhen(order.placedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNo}`}
                        aria-label={`Open ${order.orderNo}`}
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
