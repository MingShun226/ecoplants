import { ArrowUpRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { listCustomers } from "@/lib/admin/people";
import { formatSen, formatWhen } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q : "";
  const customers = await listCustomers({ search });

  const returning = customers.filter((c) => c.orderCount > 1).length;

  return (
    <AdminPage
      title="Customers"
      lead="Everyone who has ordered, grouped by email. There are no customer accounts yet, so every one of these is a guest checkout."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Customers" value={String(customers.length)} />
        <Stat label="Ordered more than once" value={String(returning)} />
        <Stat
          label="Lifetime revenue"
          value={formatSen(customers.reduce((n, c) => n + c.spentSen, 0))}
        />
      </div>

      <form action="/admin/customers" className="relative w-full sm:w-80">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Name, email or phone"
          aria-label="Search customers"
          className="h-8 w-full rounded-full border border-border-default bg-surface pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
        />
      </form>

      <AdminCard flush>
        {customers.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-text-tertiary">
            {search ? `Nothing matches “${search}”.` : "Nobody has ordered yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 text-right font-medium">Orders</th>
                  <th className="px-5 py-3 text-right font-medium">Spent</th>
                  <th className="px-5 py-3 font-medium">Last order</th>
                  <th className="w-10 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.email}
                    className="group border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-sunken"
                  >
                    <td className="max-w-[18rem] px-5 py-3">
                      <Link
                        href={`/admin/customers/${encodeURIComponent(c.email)}`}
                        className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                      >
                        {c.fullName}
                      </Link>
                      <span className="block truncate text-[11px] text-text-tertiary">{c.email}</span>
                    </td>
                    <td className="numeric px-5 py-3 text-[12px] text-text-secondary">{c.phone}</td>
                    <td className="numeric px-5 py-3 text-right text-[13px]">
                      {c.orderCount}
                      {c.orderCount > 1 ? (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-success">
                          repeat
                        </span>
                      ) : null}
                    </td>
                    <td className="numeric px-5 py-3 text-right text-[13px] font-medium">
                      {formatSen(c.spentSen)}
                    </td>
                    <td className="numeric px-5 py-3 text-[12px] text-text-tertiary">
                      {formatWhen(c.lastOrderAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/customers/${encodeURIComponent(c.email)}`}
                        aria-label={`Open ${c.fullName}`}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface px-5 py-4">
      <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">{label}</span>
      <span className="numeric text-2xl tracking-tight">{value}</span>
    </div>
  );
}
