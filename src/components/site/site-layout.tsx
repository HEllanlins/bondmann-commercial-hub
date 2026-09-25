import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { isStaffRole } from "@/lib/auth/roles";
import { PLACEHOLDER, SITE } from "@/lib/site-config";

const NAV = [
  { to: "/produtos", label: "Produtos" },
  { to: "/solucoes", label: "Soluções" },
  { to: "/empresa", label: "Empresa" },
  { to: "/servicos", label: "Serviços" },
  { to: "/contato", label: "Contato" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src="/icons/icon-192.png" alt="" className="size-8 rounded-xl" />
      <span className="font-display text-base font-bold tracking-tight">Bondmann</span>
    </Link>
  );
}

function AccountAction() {
  const { loading, session, role } = useAuth();
  if (loading) return <div className="h-9 w-24" />;
  if (!session)
    return (
      <Button asChild size="sm">
        <Link to="/auth">Entrar</Link>
      </Button>
    );
  return (
    <Button asChild size="sm">
      {isStaffRole(role) ? <Link to="/painel">Painel</Link> : <Link to="/cliente">Minha área</Link>}
    </Button>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass-strong mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-2.5">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-xl px-3 py-2 text-sm font-medium text-steel hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AccountAction />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav className="glass-strong mx-auto mt-2 flex max-w-6xl flex-col rounded-2xl p-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 text-sm sm:grid-cols-3">
        <div className="space-y-2">
          <Logo />
          <p className="text-steel">Soluções químicas para indústria, campo e serviços.</p>
        </div>
        <div className="space-y-1 text-steel">
          <p className="font-semibold text-foreground">Contato</p>
          <p>Telefone: {SITE.phone ?? PLACEHOLDER}</p>
          <p>E-mail: {SITE.email ?? PLACEHOLDER}</p>
          <p>Endereço: {SITE.address ?? PLACEHOLDER}</p>
        </div>
        <div className="space-y-1 text-steel">
          <p className="font-semibold text-foreground">Redes sociais</p>
          <p>Instagram: {SITE.instagram ?? PLACEHOLDER}</p>
          <p>LinkedIn: {SITE.linkedin ?? PLACEHOLDER}</p>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-xs text-steel">
        © {new Date().getFullYear()} {SITE.name}. Todos os direitos reservados.
      </p>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="orb-a absolute -left-24 -top-24 size-96 rounded-full bg-aqua/20 blur-3xl" />
        <div className="orb-b absolute -right-24 top-1/3 size-96 rounded-full bg-bond/15 blur-3xl" />
      </div>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 pt-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-aqua">{eyebrow}</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-steel">{text}</p>
    </section>
  );
}
