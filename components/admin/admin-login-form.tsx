"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const identifier = String(form.get("identifier") ?? "");
        const password = String(form.get("password") ?? "");

        start(async () => {
          const result = await signIn(identifier, password);
          if (result.ok) {
            // refresh() so the guarded layout re-runs with the new cookie —
            // push() alone can render from a cache that predates the session.
            router.replace("/admin/orders");
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="identifier">Username</Label>
        {/* type="text", not "email". Staff sign in with a username; the
            browser's email validation would reject it before submit. */}
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[A-Za-z][A-Za-z0-9._-]{2,29}"
          placeholder="admin"
          required
          className="rounded-sm"
        />
        <p className="text-[11px] leading-relaxed text-text-tertiary">
          Your username, not an email address.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
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
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
