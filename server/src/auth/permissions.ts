import type { AppPermission, UserRole } from "../domain/types";

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  admin: [
    "dashboard.read",
    "pre_demanda.read",
    "pre_demanda.create",
    "pre_demanda.update_status",
    "pre_demanda.associate_sei",
    "pre_demanda.read_timeline",
    "admin.ops.read",
    "admin.user.read",
    "admin.user.create",
    "admin.user.update",
    "admin.user.reset_password",
  ],
  operador: [
    "dashboard.read",
    "pre_demanda.read",
    "pre_demanda.create",
    "pre_demanda.update_status",
    "pre_demanda.associate_sei",
    "pre_demanda.read_timeline",
  ],
};

export function getPermissionsForRole(role: UserRole): AppPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: AppPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
