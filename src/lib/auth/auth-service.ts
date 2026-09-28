import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { authRedirects } from "./redirects";

/** Mensagens amigáveis — nunca expor detalhes internos, SQL ou stack traces. */
export function friendlyAuthError(message?: string | null): string {
  const raw = (message ?? "").toLowerCase();
  if (raw.includes("invalid login credentials"))
    return "Não encontramos uma conta com esses dados ou a senha está incorreta.";
  if (raw.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado.";
  if (raw.includes("banned") || raw.includes("user is banned"))
    return "Seu acesso está desativado. Fale com o administrador.";
  if (raw.includes("user already registered") || raw.includes("already been registered"))
    return "Este e-mail já possui cadastro. Tente entrar ou recuperar a senha.";
  if (raw.includes("same") && raw.includes("password"))
    return "A nova senha precisa ser diferente da anterior.";
  if (raw.includes("pwned") || raw.includes("weak") || raw.includes("known"))
    return "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra.";
  if (raw.includes("password")) return "Senha inválida: use no mínimo 8 caracteres.";
  if (raw.includes("rate limit") || raw.includes("too many") || raw.includes("security purposes"))
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
      emailRedirectTo: authRedirects.emailConfirm(),
      // O perfil é sempre criado como CLIENTE no banco; nunca aceitar role do cliente.
      data: { full_name: input.fullName.trim() },
    },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true, needsConfirmation: data.session === null };
}

export async function resendConfirmation(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: authRedirects.emailConfirm() },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

const REMEMBER_KEY = "bond-remember";
const ALIVE_KEY = "bond-alive";

/** "Lembrar sessão": quando desmarcado, a sessão termina ao fechar o navegador. */
export function setRememberSession(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    sessionStorage.setItem(ALIVE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function enforceRememberSession() {
  try {
    if (localStorage.getItem(REMEMBER_KEY) === "0" && !sessionStorage.getItem(ALIVE_KEY)) {
      localStorage.removeItem(REMEMBER_KEY);
      await supabase.auth.signOut();
    }
    sessionStorage.setItem(ALIVE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
  remember = true,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  setRememberSession(remember);
  return { ok: true };
}

/**
 * Login com Google. No ambiente de desenvolvimento usa o login gerenciado;
 * com VITE_AUTH_OAUTH_MODE="direct" (ex.: produção na Vercel) usa o fluxo
 * OAuth direto do backend, retornando para o próprio domínio.
 */
export async function signInWithGoogle(): Promise<AuthResult & { redirected?: boolean }> {
  setRememberSession(true);
  if (import.meta.env["VITE_AUTH_OAUTH_MODE"] === "direct") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirects.oauth() },
    });
    if (error) return { ok: false, error: "Não foi possível entrar com o Google." };
    return { ok: true, redirected: true };
  }
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: authRedirects.oauth(),
  });
  if (result.error) return { ok: false, error: "Não foi possível entrar com o Google." };
  if (result.redirected) return { ok: true, redirected: true };
  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authRedirects.passwordReset(),
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
