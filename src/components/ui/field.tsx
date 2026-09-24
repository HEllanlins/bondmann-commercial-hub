import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-[12px] font-semibold uppercase tracking-wide text-steel", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-card/70 px-4 text-[15px] text-foreground outline-none transition placeholder:text-steel/60 focus:border-aqua focus:ring-2 focus:ring-aqua/25 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-[15px] text-foreground outline-none transition placeholder:text-steel/60 focus:border-aqua focus:ring-2 focus:ring-aqua/25",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-steel">{hint}</p>
      ) : null}
    </div>
  );
}
