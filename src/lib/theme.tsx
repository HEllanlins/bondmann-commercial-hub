import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "bond-theme";

/** Script inline para aplicar o tema antes da renderização (evita piscar). */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function apply(pref: ThemePref) {
  const dark =
    pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as ThemePref | null) ?? "system";
    setPref(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) ?? "system") === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const set = (p: ThemePref) => {
    localStorage.setItem(KEY, p);
    setPref(p);
    apply(p);
  };
  return { pref, set };
}

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", Icon: Sun },
  { value: "dark", label: "Tema escuro", Icon: Moon },
  { value: "system", label: "Tema do sistema", Icon: Monitor },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { pref, set } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className={`inline-flex rounded-full border border-border bg-card/60 p-0.5 ${className}`}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => set(value)}
          className={`grid size-7 place-items-center rounded-full transition ${pref === value ? "bg-secondary text-foreground" : "text-steel hover:text-foreground"}`}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
