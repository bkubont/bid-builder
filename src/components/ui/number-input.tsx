"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
};

/**
 * Numeric field that can be cleared and retyped (a plain controlled
 * type="number" input snaps back to 0). Shows the decimal keypad on tablets
 * and selects its contents on focus so typing replaces the old value.
 */
export function NumberInput({ value, onValueChange, onFocus, ...props }: Props) {
  const [text, setText] = useState(() => String(value ?? 0));
  // If the value changed from outside (e.g. an AI draft), show the new value.
  const parsed = text.trim() === "" ? 0 : Number(text);
  const display = parsed === value ? text : String(value ?? 0);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9.\-]/g, "");
        setText(next);
        const n = Number(next);
        onValueChange(next.trim() === "" || Number.isNaN(n) ? 0 : n);
      }}
    />
  );
}
