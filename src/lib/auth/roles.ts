/** Perfis de acesso da plataforma. VISITANTE = usuário não autenticado. */
export type AppRole = "admin" | "colaborador" | "funcionario" | "cliente";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  funcionario: "Funcionário",
  cliente: "Cliente",
};

export const ROLE_ORDER: AppRole[] = ["admin", "colaborador", "funcionario", "cliente"];

/** Permissões granulares dos módulos internos (evoluem sem alterar o frontend). */
export const PERMISSIONS = {
  dashboard: "painel.dashboard",
  prospeccao: "painel.prospeccao",
  empresas: "painel.empresas",
  rotas: "painel.rotas",
  crm: "painel.crm",
  visitas: "painel.visitas",
  followUps: "painel.follow_ups",
  produtos: "painel.produtos",
  relatorios: "painel.relatorios",
  iaComercial: "painel.ia_comercial",
  usuarios: "painel.usuarios",
  configuracoes: "painel.configuracoes",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function isStaffRole(role: AppRole | null): boolean {
  return role === "admin" || role === "colaborador" || role === "funcionario";
}

/**
 * Autorização de interface. A autorização real é aplicada no banco (RLS):
 * esconder um menu nunca é a única proteção.
 */
export function canAccess(
  role: AppRole | null,
  permissions: string[],
  permission: Permission,
): boolean {
  if (role === "admin") return true;
  if (role !== "colaborador" && role !== "funcionario") return false;
  if (permission === PERMISSIONS.usuarios || permission === PERMISSIONS.configuracoes)
    return permissions.includes(permission) && role === "colaborador";
  if (permissions.length === 0) {
    return (
      permission === PERMISSIONS.dashboard ||
      permission === PERMISSIONS.empresas ||
      permission === PERMISSIONS.prospeccao ||
      permission === PERMISSIONS.visitas ||
      permission === PERMISSIONS.followUps ||
      permission === PERMISSIONS.crm ||
      permission === PERMISSIONS.rotas ||
      permission === PERMISSIONS.produtos ||
      permission === PERMISSIONS.iaComercial
    );
  }
  return permissions.includes(permission);
}
