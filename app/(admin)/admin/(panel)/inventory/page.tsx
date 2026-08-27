import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { AdjustStockForm } from "@/components/admin/stock-forms";
import { listMovements, listStock, totals } from "@/lib/admin/inventory";
import { getSettings } from "@/lib/admin/settings";
import { formatWhen } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Inventory" };

const VIEWS = [
  { key: "all", label: "All SKUs" },
  { key: "low", label: "Running low" },
  { key: "out", label: "Out of stock" },
  { key: "reserved", label: "Reserved" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const view = (VIEWS.find((v) => v.key === query.view)?.key ?? "all") as ViewKey;
  const search = typeof query.q === "string" ? query.q : "";

  const settings = await getSettings();
  const [rows, all, movements] = await Promise.all([
    listStock({ view, search, lowStockThreshold: settings.lowStockThreshold }),
    listStock({}),
    listMovements({ limit: 40 }),
  ]);

  const t = totals(all, settings.lowStockThreshold);

  return (
    <AdminPage
      title="Inventory"
      lead="Every SKU in one place. On hand is what is on the shelf, reserved is promised to a checkout in flight, and available is what the shop will sell. Individual adjustments also live on each product."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="SKUs" value={t.skus} />
        <Stat label="Plants on hand" value={t.onHand} />
        <Stat label="Running low" value={t.low} tone={t.low > 0 ? "warn" : undefined} />
        <Stat label="Out of stock" value={t.out} tone={t.out > 0 ? "bad" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/inventory?view=${v.key}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
            className={
              v.key === view
                ? "inline-flex h-8 items-center rounded-full border border-ink-950 bg-ink-950 px-3.5 text-[13px] text-ink-50"
                : "inline-flex h-8 items-center rounded-full border border-border-default bg-surface px-3.5 text-[13px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            }
          >
            {v.label}
          </Link>
        ))}

        <form action="/admin/inventory" className="relative ml-auto">
          <input type="hidden" name="view" value={view} />
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="SKU or plant name"
            aria-label="Search stock"
            className="h-8 w-56 rounded-full border border-border-default bg-surface pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
          />
        </form>
      </div>

      <AdminCard flush>
        {rows.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-text-tertiary">
            {search ? `Nothing matches “${search}”.` : "Nothing in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Plant</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 text-right font-medium">On hand</th>
                  <th className="px-5 py-3 text-right font-medium">Reserved</th>
                  <th className="px-5 py-3 text-right font-medium">Available</th>
                  <th className="w-24 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.variantId} className="border-b border-border-subtle last:border-b-0">
                    <td className="max-w-[16rem] px-5 py-3">
                      <Link
                        href={`/admin/products/${r.productRef}`}
                        className="block truncate text-[13px] underline-offset-4 hover:underline"
                      >
                        {r.productName}
                      </Link>
                      <span className="block text-[11px] capitalize text-text-tertiary">
                        {r.sizeKey}
                        {!r.isActive ? " · product hidden" : ""}
                      </span>
                    </td>
                    <td className="numeric px-5 py-3 text-[12px] text-text-tertiary">{r.sku}</td>
                    <td className="numeric px-5 py-3 text-right text-[13px]">{r.onHand}</td>
                    <td className="numeric px-5 py-3 text-right text-[13px] text-text-secondary">
                      {r.reserved || "—"}
                    </td>
                    <td className="numeric px-5 py-3 text-right text-[13px] font-medium">
                      <span
                        className={
                          r.available === 0
                            ? "text-danger"
                            : r.available <= settings.lowStockThreshold
                              ? "text-warning"
                              : undefined
                        }
                      >
                        {r.available}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <AdjustStockForm
                        compact
                        variantId={r.variantId}
                        sku={r.sku}
                        productName={r.productName}
                        onHand={r.onHand}
                        reserved={r.reserved}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AdminCard
        title="Movement ledger"
        lead="Every adjustment, and who made it. Append-only — a correction is another movement, never an edit."
        flush
      >
        {movements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-tertiary">
            No adjustments yet. Stock changes made by orders are on the order timeline
            instead.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {movements.map((m) => (
              <li key={m.id} className="flex gap-4 px-5 py-3">
                <span className="numeric w-20 shrink-0 pt-0.5 text-[11px] text-text-tertiary">
                  {formatWhen(m.createdAt)}
                </span>
                <span
                  className={`numeric w-12 shrink-0 text-[13px] font-medium ${
                    m.delta > 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">
                    {m.productName} <span className="numeric text-text-tertiary">{m.sku}</span>
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    <span className="capitalize">{m.reason}</span>
                    {m.note ? ` · ${m.note}` : ""} · {m.actorName} · left{" "}
                    <span className="numeric">{m.quantityAfter}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminPage>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "bad";
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border bg-surface px-5 py-4 ${
        tone === "bad"
          ? "border-danger/40"
          : tone === "warn"
            ? "border-warning/40"
            : "border-border-subtle"
      }`}
    >
      <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary">{label}</span>
      <span className="numeric text-2xl tracking-tight">{value}</span>
    </div>
  );
}
