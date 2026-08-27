"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { formatPhoneInput, normalisePhone } from "@/lib/account/phone";
import { cn } from "@/lib/utils";

/**
 * The Malaysian mobile number field.
 *
 * Shared between signing in, signing up and checkout, because the number means
 * the same thing in all three: it is the account, it is where order updates go,
 * and it is the WhatsApp thread. Two people typing the same number two
 * different ways must never produce two accounts, so three things work
 * together:
 *
 *  - `+60` is a fixed label, not something to type. That removes the whole
 *    "with or without the zero, with or without the country code" question.
 *  - The national part is regrouped on every keystroke — `12-345 6789`,
 *    or `11-1234 5678` for the prefixes that carry an extra digit.
 *  - A leading zero typed out of habit is absorbed rather than rejected.
 *
 * The border turns leaf-green once the number is complete. That is the only
 * feedback the field gives, and it says nothing at all to someone who is still
 * halfway through typing.
 */
export function PhoneField({
  id = "phone",
  name = "phone",
  value,
  onChange,
  label,
  hint,
  autoFocus,
  required = true,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  /** Defaults to the shared "Phone Number" label. */
  label?: string;
  hint?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const t = useTranslations("account");
  const complete = normalisePhone(value) !== null;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label ?? t("phone")}</Label>

      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-sm border bg-surface transition-colors",
          complete ? "border-leaf-700" : "border-border-default focus-within:border-border-strong",
        )}
      >
        {/* `text-base md:text-sm` on the field is not a size preference — it is
            the same rule `components/ui/input.tsx` follows. iOS Safari zooms the
            page in whenever a focused field is under 16px and never zooms back
            out, so a 14px input here left every phone user stranded at 1.3x on
            the login, signup and checkout screens. The prefix tracks the field
            so the two stay on one baseline. */}
        <span className="numeric flex select-none items-center border-r border-border-default bg-surface-sunken px-3.5 text-base text-text-secondary md:text-sm">
          +60
        </span>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          required={required}
          value={value}
          onChange={(e) => onChange(formatPhoneInput(e.target.value))}
          placeholder="12-345 6789"
          aria-describedby={hintId}
          className="numeric h-10 w-full min-w-0 bg-transparent px-3.5 text-base outline-none placeholder:text-text-tertiary md:text-sm"
        />
      </div>

      <p id={hintId} className="text-xs leading-relaxed text-text-tertiary">
        {hint ?? t("phoneHint")}
      </p>
    </div>
  );
}
