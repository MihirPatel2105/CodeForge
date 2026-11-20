"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const AUTHENTICATOR_CODE_LENGTH = 6;

type Props = {
  id: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** The wrapper's layout; defaults to a label-over-input stack. */
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

/** The 6-digit authenticator code asked for when an account with 2FA makes a
 * destructive change. Digits only, capped at six, so a pasted "123 456" still fits.
 * No `maxLength`: the browser would cut "123 456" to "123 45" before this sees it. */
export function AuthenticatorCodeField({
  id,
  value,
  onChange,
  disabled,
  className = "flex flex-col gap-[6px]",
  labelClassName,
  inputClassName,
}: Props) {
  return (
    <div className={className}>
      <Label htmlFor={id} className={labelClassName}>
        Authenticator code
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        disabled={disabled}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, AUTHENTICATOR_CODE_LENGTH))
        }
        className={`${inputClassName ?? ""} font-mono tracking-[0.2em]`}
      />
    </div>
  );
}
