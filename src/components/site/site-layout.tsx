import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLACEHOLDER, SITE } from "@/lib/site-config";
import { ThemeToggle } from "@/lib/theme";
import { AccessChoice } from "@/components/platform/access-choice";
import { rememberAccess } from "@/lib/platform/data";

const NAV = [
  { to: "/produtos", label: "Produtos" },
  { to: "/solucoes", label: "Soluções" },
  { to: "/empresa", label: "Empresa" },
  { to: "/servicos", label: "Serviços" },
  { to: "/contato", label: "Contato" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <img src="/icons/icon-192.png" alt="" className="size-8 rounded-xl" />
      <span className="font-display text-base font-bold tracking-tight">Bondmann</span>
    </Link>
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
          <AccessChoice />
          <div className="hidden shrink-0 sm:block"><ThemeToggle /></div>
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
          <div className="sm:hidden"><ThemeToggle /></div>
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
          <Link to="/login" onClick={()=>rememberAccess("admin")} className="mt-4 inline-block text-xs text-steel hover:text-foreground">Área Restrita</Link>
          <div><Link to="/planos" className="text-xs text-steel hover:text-foreground">Planos e assinaturas</Link></div>
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
