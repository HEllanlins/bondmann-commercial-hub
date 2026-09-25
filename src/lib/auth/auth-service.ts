import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

/** Mensagens amigáveis — nunca expor detalhes internos, SQL ou stack traces. */
export function friendlyAuthError(message?: string | null): string {
  const raw = (message ?? "").toLowerCase();
  if (raw.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (raw.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (raw.includes("user already registered") || raw.includes("already been registered"))
    return "Este e-mail já possui cadastro. Tente entrar ou recuperar a senha.";
  if (raw.includes("password")) return "Senha inválida: use no mínimo 8 caracteres.";
  if (raw.includes("rate limit") || raw.includes("too many"))
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  if (raw.includes("network") || raw.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

export type AuthResult = { ok: boolean; error?: string; needsConfirmation?: boolean };

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth`,
      // O perfil é sempre criado como CLIENTE no banco; nunca aceitar role do cliente.
      data: { full_name: input.fullName.trim() },
    },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true, needsConfirmation: data.session === null };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

/** Login com Google (OAuth gerenciado). */
export async function signInWithGoogle(): Promise<AuthResult & { redirected?: boolean }> {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) return { ok: false, error: "Não foi possível entrar com o Google." };
  if (result.redirected) return { ok: true, redirected: true };
  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

/** Definição de nova senha durante a recuperação (sessão de recovery). */
export async function updatePasswordFromRecovery(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

/** Alteração de senha de um usuário autenticado. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}
