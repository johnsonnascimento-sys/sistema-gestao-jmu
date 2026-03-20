import type { AppPermission, UserRole } from "../domain/types";

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  admin: [
    "dashboard.read",
    "pre_demanda.read",
    "pre_demanda.create",
    "pre_demanda.update",
    "pre_demanda.update_status",
    "pre_demanda.associate_sei",
    "pre_demanda.read_timeline",
    "pre_demanda.manage_interessados",
    "pre_demanda.manage_vinculos",
    "pre_demanda.manage_tramitacao",
    "pre_demanda.manage_tarefas",
    "pre_demanda.manage_audiencias",
    "cadastro.interessado.read",
    "cadastro.interessado.write",
    "cadastro.setor.read",
    "cadastro.setor.write",
    "cadastro.norma.read",
    "cadastro.norma.write",
    "cadastro.assunto.read",
    "cadastro.assunto.write",
    "admin.ops.read",
    "admin.ops.update",
    "admin.user.read",
    "admin.user.create",
    "admin.user.update",
    "admin.user.reset_password",
    "admin.audit.read",
  ],
  operador: [
    "dashboard.read",
    "pre_demanda.read",
    "pre_demanda.create",
    "pre_demanda.update",
    "pre_demanda.update_status",
    "pre_demanda.associate_sei",
    "pre_demanda.read_timeline",
    "pre_demanda.manage_interessados",
    "pre_demanda.manage_vinculos",
    "pre_demanda.manage_tramitacao",
    "pre_demanda.manage_tarefas",
    "pre_demanda.manage_audiencias",
    "cadastro.interessado.read",
    "cadastro.interessado.write",
    "cadastro.setor.read",
    "cadastro.norma.read",
    "cadastro.assunto.read",
  ],
};

export function getPermissionsForRole(role: UserRole): AppPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: AppPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
