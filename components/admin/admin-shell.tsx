"use client";

import {
  ClipboardList,
  Images,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageSquareQuote,
  PackageSearch,
  Settings,
  Sparkles,
  Tags,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

/**
 * The panel's navigation rail.
 *
 * Grouped by what someone is trying to do, not by table name: Today is the
 * queue, Catalogue is what we sell, People is who buys it. Only modules that
 * exist are listed — a sidebar full of dead links that bounce to a 404 makes an
 * operator distrust everything else on the screen.
 */
const GROUPS = [
  {
    label: null,
    items: [
      { href: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
      { href: "/admin/orders", label: "Orders", Icon: ClipboardList },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", Icon: Leaf },
      { href: "/admin/inventory", label: "Inventory", Icon: Warehouse },
      { href: "/admin/categories", label: "Categories", Icon: Tags },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/customers", label: "Customers", Icon: Users },
      { href: "/admin/reviews", label: "Reviews", Icon: MessageSquareQuote },
      { href: "/admin/quiz", label: "Quiz answers", Icon: Sparkles },
    ],
  },
  {
    label: null,
    items: [{ href: "/admin/settings", label: "Settings", Icon: Settings }],
  },
] as const;

export function AdminShell({
  adminName,
  adminUsername,
  adminRole,
  actionable,
  pendingReviews,
  children,
}: {
  adminName: string;
  adminUsername: string;
  adminRole: string;
  actionable: number;
  pendingReviews: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const badges: Record<string, number> = {
    "/admin/orders": actionable,
    "/admin/reviews": pendingReviews,
  };

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Rail
        badges={badges}
        adminName={adminName}
        adminUsername={adminUsername}
        adminRole={adminRole}
        className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border-subtle lg:flex"
      />

      {/* Mobile drawer */}
      <div className={cn("lg:hidden", !open && "pointer-events-none")} aria-hidden={!open}>
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={cn(
            "fixed inset-0 z-50 cursor-default bg-ink-950/40 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <Rail
          badges={badges}
          adminName={adminName}
          adminUsername={adminUsername}
          adminRole={adminRole}
          onNavigate={() => setOpen(false)}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-60 overflow-y-auto border-r border-border-subtle bg-canvas",
            "transition-transform duration-300 ease-refined",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border-subtle bg-canvas/90 px-4 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="-ml-2 flex size-9 items-center justify-center rounded-full lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <span className="truncate text-sm font-medium">EcoPlants admin</span>

            {/*
              Paid orders that nobody has started packing. It rides in the
              header on every screen for the same reason a kitchen prints
              tickets: whoever is looking at anything should see that money has
              come in and nothing has moved, without going to look for it.
            */}
            {actionable > 0 ? (
              <Link
                href="/admin/orders?view=actionable"
                className="ml-1 flex min-w-0 items-center gap-2 rounded-full border border-warning/40 bg-warning-soft px-3 py-1.5 text-xs transition-colors hover:border-warning"
              >
                <span aria-hidden="true" className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-warning" />
                </span>
                <PackageSearch className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {actionable} {actionable === 1 ? "order needs" : "orders need"} packing
                </span>
              </Link>
            ) : null}
          </div>

          <span className="lg:hidden">
            <SignOutButton />
          </span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-5 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Rail({
  badges,
  adminName,
  adminUsername,
  adminRole,
  onNavigate,
  className,
}: {
  badges: Record<string, number>;
  adminName: string;
  adminUsername: string;
  adminRole: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex-col", className)}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <span className="font-display text-lg">EcoPlants</span>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="-mr-2 flex size-9 items-center justify-center rounded-full lg:hidden"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {GROUPS.map((group, i) => (
          <div key={group.label ?? `group-${i}`} className={i > 0 ? "mt-5" : undefined}>
            {group.label ? (
              <p className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
                {group.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, Icon, ...rest }) => {
                // Overview is `/admin` itself, so a prefix match would light it
                // up on every screen in the panel.
                const exact = "exact" in rest && rest.exact;
                const active = exact ? pathname === href : pathname.startsWith(href);
                const badge = badges[href] ?? 0;

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors",
                        active
                          ? "bg-surface-sunken font-medium text-text-primary"
                          : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{label}</span>
                      {badge > 0 ? (
                        <span className="numeric rounded-full bg-ink-950 px-1.5 py-0.5 text-[10px] font-medium text-ink-50">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <p className="mt-5 flex gap-2 px-3 text-[11px] leading-relaxed text-text-tertiary">
          <Images className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Product photography is not managed here yet — there is no imagery to
            manage. See ADR&nbsp;0006.
          </span>
        </p>
      </nav>

      <div className="flex shrink-0 items-center gap-3 border-t border-border-subtle px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-[11px] text-ink-50">
          {adminName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{adminName}</p>
          <p className="truncate text-[11px] text-text-tertiary">
            <span className="numeric">{adminUsername}</span>
            <span className="capitalize"> · {adminRole}</span>
          </p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}

function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void signOut())}
      aria-label="Sign out"
      className="flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-sunken hover:text-text-primary disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden="true" />
    </button>
  );
}
