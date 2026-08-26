import { KeyRound, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getSessionAdmin } from "@/lib/admin/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  // Already signed in? The login page is a dead end for an admin.
  const admin = await getSessionAdmin();
  if (admin) redirect("/admin/orders");

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/*
        The same 14-unit bar the panel wears on every screen. Arriving at the
        login should feel like standing at the panel's front door rather than
        on an unrelated page that happens to ask for a password.
      */}
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border-subtle px-5">
        {/* Same wordmark treatment as the panel rail, so the two read as one place. */}
        <span className="font-display text-lg leading-none">EcoPlants</span>
        <span
          aria-hidden="true"
          className="ml-1 hidden h-3.5 w-px bg-border-default sm:block"
        />
        <span className="hidden text-[11px] uppercase tracking-[0.16em] text-text-tertiary sm:block">
          Staff panel
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[24rem]">
          <h1 className="font-display text-[2rem] leading-[1.1] tracking-tight">Sign in</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">
            This is the shop&apos;s back office — orders, stock and the catalogue.
          </p>

          <div className="mt-8 rounded-xl border border-border-subtle bg-surface p-6 shadow-card">
            <AdminLoginForm />
          </div>

          {/* Two things worth knowing before someone starts guessing: accounts
              are handed out, and this is not where customers sign in. */}
          <ul className="mt-7 flex flex-col gap-3">
            <li className="flex gap-2.5 text-[12px] leading-relaxed text-text-tertiary">
              <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Panel access is granted per account. If you cannot sign in, ask an owner to
                add you rather than creating a second account.
              </span>
            </li>
            <li className="flex gap-2.5 text-[12px] leading-relaxed text-text-tertiary">
              <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Shopping for plants? Customer accounts live on{" "}
                {/* Plain next/link, not the i18n one: this page lives outside
                    the [locale] tree, so the locale is chosen explicitly. */}
                <Link
                  href="/en/login"
                  className="underline underline-offset-2 hover:text-text-primary"
                >
                  the shop
                </Link>
                , not here.
              </span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
