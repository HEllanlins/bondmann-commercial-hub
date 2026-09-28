/**
 * Endereços de retorno da autenticação — centralizados.
 * Em produção (Vercel) defina VITE_SITE_URL com o domínio oficial
 * (ex.: https://hub.bondmann.com.br). Sem essa variável, usa o domínio
 * em que o site está aberto (preview / desenvolvimento).
 */
export function siteUrl(): string {
  const configured = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/+$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export const AUTH_ROUTES = {
  login: "/login",
  signup: "/cadastro",
  forgot: "/recuperar-senha",
  confirm: "/auth/confirm",
  resetPassword: "/auth/reset-password",
  staffHome: "/painel",
  clientHome: "/cliente",
} as const;

export const authRedirects = {
  emailConfirm: () => `${siteUrl()}${AUTH_ROUTES.confirm}`,
  passwordReset: () => `${siteUrl()}${AUTH_ROUTES.resetPassword}`,
  oauth: () => `${siteUrl()}${AUTH_ROUTES.login}`,
  afterLogout: AUTH_ROUTES.login,
};
