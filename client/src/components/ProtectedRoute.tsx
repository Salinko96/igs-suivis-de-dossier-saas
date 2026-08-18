import { useAuth } from "@/_core/hooks/useAuth";
import { PermissionsMatrix, usePermissions } from "@/hooks/usePermissions";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Redirect, useLocation } from "wouter";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  requirePermission?: (perms: PermissionsMatrix) => boolean;
  allowedRoles?: string[];
  fallbackPath?: string;
  [key: string]: any;
}

export function ProtectedRoute({
  component: Component,
  requirePermission,
  allowedRoles,
  fallbackPath,
  ...rest
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const perms = usePermissions();
  const [, setLocation] = useLocation();
  const warnedRef = useRef(false);

  const isAuthorized = (() => {
    if (loading) return true; // Don't redirect while still determining auth state
    if (!user) return true; // Laisser DashboardLayout afficher l'espace ou le sélecteur de rôles
    if (perms.isAdmin) return true;
    if (allowedRoles && !allowedRoles.includes(perms.role)) return false;
    if (requirePermission && !requirePermission(perms)) return false;
    return true;
  })();

  const targetRedirect = fallbackPath || perms.defaultRoute;

  useEffect(() => {
    if (!loading && !isAuthorized && !warnedRef.current) {
      warnedRef.current = true;
      toast.warning("Accès restreint", {
        description: `Votre profil (${perms.roleBadge}) n'a pas les droits nécessaires pour accéder à cette page.`,
      });
      setLocation(targetRedirect, { replace: true });
    }
  }, [loading, isAuthorized, perms.roleBadge, targetRedirect, setLocation]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f5f7f6]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#1d7764] border-t-transparent" />
          <span className="text-xs font-medium text-[#7a8a85]">Vérification des autorisations...</span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Redirect to={targetRedirect} replace />;
  }

  return <Component {...rest} />;
}
