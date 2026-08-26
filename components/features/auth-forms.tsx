"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signIn, signOut, signUp, updateProfile } from "@/lib/account/actions";
import { PhoneField } from "@/components/features/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * Sign in and sign up. The phone field they share lives in
 * `components/features/phone-field.tsx` — checkout uses the same one.
 */
export function SignInForm() {
  const t = useTranslations("account");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const password = String(new FormData(e.currentTarget).get("password") ?? "");
        start(async () => {
          const result = await signIn(phone, password);
          if (result.ok) {
            // Signing in is a deliberate trip to the account, so that is where
            // it lands.
            router.push("/account");
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-5"
    >
      <PhoneField value={phone} onChange={setPhone} autoFocus />

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-sm"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? t("working") : t("signIn")}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        {t("noAccount")}{" "}
        <Link href="/signup" className="underline underline-offset-4 hover:text-text-primary">
          {t("signUp")}
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const t = useTranslations("account");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        const password = String(data.get("password") ?? "");
        const fullName = String(data.get("fullName") ?? "");

        start(async () => {
          const result = await signUp(phone, password, fullName);
          if (!result.ok) {
            setError(result.error);
            return;
          }

          // Not the account page. A brand-new account has no orders in it, so
          // landing there means the first thing a customer sees after signing
          // up is an empty list and a note about SMS. Send them to the plants
          // instead and confirm the account in a toast — the account page is
          // one tap away in the header whenever they want it.
          toast.success(t("welcome", { name: fullName.trim().split(" ")[0] }));
          router.push("/category/indoor");
          router.refresh();
        });
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          autoFocus
          className="rounded-sm"
        />
        <p className="text-xs text-text-tertiary">{t("fullNameHint")}</p>
      </div>

      <PhoneField value={phone} onChange={setPhone} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="rounded-sm"
        />
        <p className="text-xs text-text-tertiary">{t("passwordHint")}</p>
      </div>

      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? t("working") : t("signUp")}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        {t("haveAccount")}{" "}
        <Link href="/login" className="underline underline-offset-4 hover:text-text-primary">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOut();
          router.push("/");
          router.refresh();
        })
      }
      className={className}
    >
      {pending ? t("working") : t("signOut")}
    </button>
  );
}

export function ProfileForm({ fullName }: { fullName: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await updateProfile(name);
          if (result.ok) {
            setSaved(true);
            router.refresh();
            window.setTimeout(() => setSaved(false), 2000);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="profileName">{t("fullName")}</Label>
        <Input
          id="profileName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-sm sm:max-w-sm"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || name === fullName} className="w-fit">
        {pending ? t("working") : saved ? t("saved") : t("saveProfile")}
      </Button>
    </form>
  );
}
