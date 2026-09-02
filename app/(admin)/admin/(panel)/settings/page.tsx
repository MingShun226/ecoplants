import type { Metadata } from "next";
import { AdminCard, AdminPage } from "@/components/admin/admin-page";
import { ChangePasswordForm, SettingsForm } from "@/components/admin/misc-forms";
import { getSessionAdmin } from "@/lib/admin/session";
import { getSettings } from "@/lib/admin/settings";
import { formatStamp } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  // The layout above already refused anyone without one, so this cannot be null
  // by the time the page renders.
  const admin = await getSessionAdmin();

  return (
    <AdminPage
      title="Settings"
      lead="Commercial rules the storefront reads on every page. Changing one takes effect immediately."
    >
      <AdminCard
        title="Delivery and guarantee"
        lead={
          settings.updatedAt
            ? `Last changed ${formatStamp(settings.updatedAt)}`
            : "Never changed from the defaults."
        }
      >
        <SettingsForm settings={settings} />
      </AdminCard>

      <AdminCard
        title="Your password"
        lead={`Signed in as ${admin?.username ?? "—"}. Changing it does not sign you out.`}
      >
        <ChangePasswordForm username={admin?.username ?? ""} />
      </AdminCard>

      <AdminCard title="Not editable here">
        <ul className="flex flex-col gap-3 text-[13px] leading-relaxed text-text-secondary">
          <li>
            <strong className="font-medium text-text-primary">East Malaysia rules.</strong>{" "}
            Which plants can go to Sabah and Sarawak is per product — the “Peninsular
            Malaysia only” tick on each one — not a global setting, because it depends on
            the plant surviving 7–8 days in transit.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Copy and labels.</strong>{" "}
            Every piece of shop text lives in{" "}
            <code className="text-text-primary">messages/en.json</code>,{" "}
            <code className="text-text-primary">ms.json</code> and{" "}
            <code className="text-text-primary">zh.json</code> so it can be translated
            together. Settings hold values, never sentences.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Payment.</strong> No
            gateway is connected, so payment state is set by hand on each order. Its keys
            will be environment variables, not rows in this table — a secret in the
            database is a secret in every backup.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Staff accounts.</strong>{" "}
            Admins are provisioned server-side and cannot be created from the panel. That
            is deliberate: an admin panel that can mint admins is one compromised session
            away from being permanent.
          </li>
        </ul>
      </AdminCard>
    </AdminPage>
  );
}
