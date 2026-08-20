import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";

export type Role = "admin" | "declarant" | "comptable" | "client" | "manager" | "user";

export interface PermissionsMatrix {
  role: Role;
  isAdmin: boolean;
  isDeclarant: boolean;
  isComptable: boolean;
  isClient: boolean;
  isManager: boolean;
  canManageUsers: boolean;
  canViewFinances: boolean;
  canViewControls: boolean;
  canViewPlanning: boolean;
  canEditCustoms: boolean;
  canManageInvoices: boolean;
  canCreateDossier: boolean;
  canDeleteDossier: boolean;
  canViewAudit: boolean;
  canViewAllCompanies: boolean;
  canViewMargin: boolean;
  defaultRoute: string;
  roleBadge: string;
}

export function getRoleBadge(role?: string | null): string {
  switch (role) {
    case "declarant":
      return "Déclarant PAC";
    case "comptable":
      return "Comptable";
    case "client":
      return "Client";
    case "manager":
      return "Manager";
    case "admin":
      return "Admin";
    default:
      return "Utilisateur";
  }
}

export function resolvePermissions(role?: string | null): PermissionsMatrix {
  const r = (role || "user") as Role;
  const isAdmin = r === "admin";
  const isDeclarant = r === "declarant";
  const isComptable = r === "comptable";
  const isClient = r === "client";
  const isManager = r === "manager";

  let defaultRoute = "/";
  if (isDeclarant) defaultRoute = "/planning";
  else if (isComptable) defaultRoute = "/finances";
  else if (isClient) defaultRoute = "/portail-client";

  return {
    role: r,
    isAdmin,
    isDeclarant,
    isComptable,
    isClient,
    isManager,
    canManageUsers: isAdmin,
    canViewFinances: isAdmin || isManager || isComptable,
    canViewControls: isAdmin || isManager || isDeclarant,
    canViewPlanning: isAdmin || isManager || isDeclarant,
    canEditCustoms: isAdmin || isManager || isDeclarant,
    canManageInvoices: isAdmin || isManager || isComptable,
    canCreateDossier: isAdmin || isManager || isDeclarant,
    canDeleteDossier: isAdmin,
    canViewAudit: isAdmin || isManager || isDeclarant || isComptable,
    canViewAllCompanies: !isClient,
    canViewMargin: isAdmin || isManager || isComptable,
    defaultRoute,
    roleBadge: getRoleBadge(r),
  };
}

export function usePermissions(): PermissionsMatrix {
  const { user } = useAuth();
  return useMemo(() => resolvePermissions(user?.role), [user?.role]);
}
