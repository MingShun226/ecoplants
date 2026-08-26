import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ACTIONABLE, countByStatus } from "@/lib/admin/orders";
import { countPendingReviews } from "@/lib/admin/people";
import { getSessionAdmin } from "@/lib/admin/session";

/**
 * The gate.
 *
 * A signed-in user is NOT an admin: the check is for an active row in
 * `admin_users`, not merely a session. It lives in the `(panel)` route group
 * precisely so it does not wrap `/admin/login` — one level up, the guard would
 * wrap its own login page and redirect to the route it was guarding, which a
 * browser reports as "too many redirects".
 *
 * This is one of three independent defences. RLS refuses the same data at the
 * database, and `transition_order()` refuses non-admin callers, so a bug here
 * does not become a breach.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");

  // Both counts feed nav badges on every screen, so they are fetched together
  // rather than each page worrying about them.
  const [counts, pendingReviews] = await Promise.all([countByStatus(), countPendingReviews()]);
  const actionable = ACTIONABLE.reduce((n, s) => n + counts[s], 0);

  return (
    <AdminShell
      adminName={admin.fullName}
      adminUsername={admin.username}
      adminRole={admin.role}
      actionable={actionable}
      pendingReviews={pendingReviews}
    >
      {children}
    </AdminShell>
  );
}
