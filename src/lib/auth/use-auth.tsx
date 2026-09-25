import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./roles";

export type AccessInfo = { role: AppRole | null; permissions: string[] };

/** Lê o perfil de acesso do usuário. O banco (RLS) só devolve as linhas do próprio usuário. */
export async function fetchAccess(userId: string): Promise<AccessInfo> {
  const [{ data: roles }, { data: perms }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("role_permissions").select("permission").eq("user_id", userId),
  ]);
  const list = (roles ?? []).map((r) => r.role as AppRole);
  const role: AppRole | null = list.includes("admin")
    ? "admin"
    : list.includes("colaborador")
      ? "colaborador"
      : list.includes("cliente")
        ? "cliente"
        : null;
  return { role, permissions: (perms ?? []).map((p) => p.permission) };
}

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  permissions: string[];
  fullName: string | null;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  role: null,
  permissions: [],
  fullName: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    role: null,
    permissions: [],
    fullName: null,
  });

  useEffect(() => {
    let active = true;

    async function apply(session: Session | null) {
      if (!session) {
        if (active)
          setState({ loading: false, session: null, user: null, role: null, permissions: [], fullName: null });
        return;
      }
      const [access, profile] = await Promise.all([
        fetchAccess(session.user.id),
        supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
      ]);
      if (active)
        setState({
          loading: false,
          session,
          user: session.user,
          role: access.role,
          permissions: access.permissions,
          fullName: profile.data?.full_name ?? null,
        });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      // Evita chamadas ao banco dentro do callback síncrono.
      setTimeout(() => void apply(session), 0);
    });
    void supabase.auth.getSession().then(({ data }) => apply(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function signOut() {
  await supabase.auth.signOut();
}
