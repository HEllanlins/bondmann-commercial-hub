import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Cartão de vidro — superfície base de toda a plataforma. */
export function GlassCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass rounded-3xl", className)} {...props} />;
}

export function SectionHeading({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
      {action}
    </div>
  );
}

export function Pill({ children, tone = "aqua" }: { children: ReactNode; tone?: "aqua" | "bond" | "steel" }) {
  const tones = {
    aqua: "bg-aqua/10 text-aqua",
    bond: "bg-bond/10 text-bond",
    steel: "bg-steel/10 text-steel",
  } as const;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function PageLoader({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-steel">
      <Spinner className="size-6 text-aqua" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-steel/10", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <GlassCard className="p-6 text-center">
      {icon ? (
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-2xl bg-aqua/10 text-aqua">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-sm font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-[42ch] text-[13px] leading-relaxed text-steel">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </GlassCard>
  );
}

/** Aviso de módulo ainda em desenvolvimento. */
export function DevelopmentNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-bond/40 bg-bond/5 p-4 text-[13px] leading-relaxed text-steel">
      <span className="font-semibold text-bond">Em desenvolvimento. </span>
      {children ?? "Este módulo já está previsto na arquitetura e será construído nas próximas etapas."}
    </div>
  );
}
