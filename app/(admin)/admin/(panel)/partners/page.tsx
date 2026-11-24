import { ArrowUpRight, MapPinOff, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { formatPhone } from "@/lib/account/phone";
import { PARTNER_STATUS_LABEL, type PartnerStatus } from "@/lib/admin/enums";
import { formatStamp } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/href";
import { isClosedNow, listPartners } from "@/lib/admin/partners";

export const metadata: Metadata = { title: "Nurseries" };

const VIEWS: { key: PartnerStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "onboarding", label: "Onboarding" },
  { key: "paused", label: "Paused" },
  { key: "ended", label: "Ended" },
];

const STATUS_DOT: Record<PartnerStatus, string> = {
  active: "bg-success",
  onboarding: "bg-warning",
  paused: "bg-border-strong",
  ended: "bg-border-strong",
};

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const view = VIEWS.find((v) => v.key === query.view)?.key ?? "all";
  const search = typeof query.q === "string" ? query.q : "";

  const partners = await listPartners({ status: view, search });
  const nurseries = partners.filter((p) => p.kind === "nursery");

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view: view === "all" ? undefined : view, q: search || undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") p.set(k, v);
    return adminHref(`/admin/partners${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <AdminPage
      title="Nurseries"
      lead="Who grows and packs what the shop sells. EcoPlants' own stock is listed first; every other row is a partner nursery."
      actions={
        <Link
          href={adminHref("/admin/partners/new")}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-950 px-3.5 text-[13px] text-ink-50 transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add nursery
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

        <form action="/admin/partners" className="relative ml-auto">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Name, area, contact or number"
            aria-label="Search nurseries"
            className="h-8 w-64 rounded-full border border-border-default bg-surface pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong"
          />
        </form>
      </div>

      {view === "all" && !search && nurseries.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-surface-sunken px-5 py-4 text-sm leading-relaxed">
          <strong className="font-medium">No partner nurseries yet.</strong> Add the first one, then list the
          plants it can supply and what it is paid for each. Nothing reaches a nursery until it is set to Active
          and has a location.
        </div>
      ) : null}

      <AdminCard flush>
        {partners.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-text-tertiary">
            {search ? `Nothing matches “${search}”.` : "Nothing in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Nursery</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Delivers</th>
                  <th className="px-5 py-3 text-right font-medium">Plants</th>
                  <th className="px-5 py-3 font-medium">WhatsApp</th>
                  <th className="w-10 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => {
                  const closed = isClosedNow(p.closedUntil);
                  return (
                    <tr
                      key={p.id}
                      className="group border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-sunken"
                    >
                      <td className="max-w-[20rem] px-5 py-3">
                        <Link
                          href={adminHref(`/admin/partners/${p.slug}`)}
                          className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                        >
                          {p.displayName}
                          {p.kind === "house" ? (
                            <span className="ml-2 rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-text-secondary">
                              Own stock
                            </span>
                          ) : null}
                        </Link>
                        <span className="block truncate text-[11px] text-text-tertiary">
                          {[p.areaLabel, p.contactName].filter(Boolean).join(" · ") || "No area set"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
                          <span className={`size-1.5 rounded-full ${STATUS_DOT[p.status]}`} aria-hidden="true" />
                          {PARTNER_STATUS_LABEL[p.status]}
                        </span>
                        {closed && p.closedUntil ? (
                          <span className="block text-[11px] text-warning">
                            Closed until <span className="numeric">{formatStamp(p.closedUntil)}</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-[13px]">
                        {p.hasLocation ? (
                          <span className="numeric text-text-secondary">Within {p.radiusKm} km</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-warning">
                            <MapPinOff className="size-3.5" aria-hidden="true" />
                            No location
                          </span>
                        )}
                      </td>
                      <td className="numeric px-5 py-3 text-right text-[13px]">
                        {p.kind === "house" ? (
                          <Link href="/admin/inventory" className="text-text-secondary underline-offset-4 hover:underline">
                            Inventory
                          </Link>
                        ) : (
                          p.offerCount
                        )}
                      </td>
                      <td className="numeric px-5 py-3 text-[13px] text-text-secondary">
                        {p.whatsapp ? (
                          <a
                            href={`https://wa.me/${p.whatsapp.replace(/^\+/, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline-offset-4 hover:underline"
                          >
                            {formatPhone(p.whatsapp)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={adminHref(`/admin/partners/${p.slug}`)}
                          aria-label={`Open ${p.displayName}`}
                          className="flex size-7 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
