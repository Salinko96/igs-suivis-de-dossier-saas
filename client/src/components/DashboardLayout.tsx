import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import { usePermissions, resolvePermissions, Role } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  Bell, 
  CalendarDays, 
  CircleDollarSign, 
  ClipboardCheck, 
  FolderKanban, 
  Globe, 
  KeyRound,
  LayoutDashboard, 
  Lock,
  LogOut, 
  PanelLeft, 
  Plus, 
  ShieldAlert, 
  UserCheck 
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const allMenuItems = [
  { icon: LayoutDashboard, label: "Pilotage & KPI", path: "/", roles: ["admin", "comptable", "manager"] },
  { icon: FolderKanban, label: "Tous les Dossiers", path: "/dossiers", roles: ["admin", "declarant", "comptable", "manager", "client"] },
  { icon: CircleDollarSign, label: "Finances & Facturation", path: "/finances", roles: ["admin", "comptable", "manager"] },
  { icon: CalendarDays, label: "Planning & Échéances", path: "/planning", roles: ["admin", "declarant", "manager"] },
  { icon: ShieldAlert, label: "Contrôles Douane & PAC", path: "/controles", roles: ["admin", "declarant", "manager"] },
  { icon: Globe, label: "Portail Client Externe", path: "/portail-client", roles: ["admin", "client"] },
];

const SIDEBAR_WIDTH_KEY = "igs-sidebar-width";
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 220;
const MAX_WIDTH = 380;
const IGS_LOGO = "/igs-logo-transparent.png";
const IGS_LOGO_SIDEBAR = "/igs-logo-sidebar.png";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user, login } = useAuth();
  const [, setLocation] = useLocation();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);

  const handleAccess = async (role: "admin" | "declarant" | "comptable" | "manager" | "client" = "admin") => {
    setIsSigningIn(true);
    try {
      let name = "Ibrahima Gold Service (Admin)";
      if (role === "declarant") name = "Mamadou Diallo (Déclarant PAC)";
      if (role === "comptable") name = "Fatoumata Camara (Comptable)";
      if (role === "client") name = "Guinean Birimian Gold S.A";
      if (role === "manager") name = "Alpha Barry (Manager Opérations)";

      await login({ role, name });
      const targetPerms = resolvePermissions(role);
      setLocation(targetPerms.defaultRoute);
      toast.success(`Espace ${targetPerms.roleBadge} activé`);
    } catch (e) {
      console.error("Login error:", e);
      toast.error("Erreur de connexion");
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f7f6] px-5 py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-24 w-[42rem] mix-blend-multiply opacity-[0.05]">
          <img src={IGS_LOGO} alt="" className="igs-logo-drift w-full" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-60 -left-56 w-[40rem] mix-blend-multiply opacity-[0.03]">
          <img src={IGS_LOGO} alt="" className="igs-logo-drift igs-logo-drift-delayed w-full" />
        </div>
        <div className="relative z-10 w-full max-w-lg rounded-[2rem] border border-white/90 bg-white/95 p-8 sm:p-9 text-center shadow-[0_24px_70px_rgba(20,50,43,0.14)] backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-20 items-center justify-center">
            <img src={IGS_LOGO} alt="IGS — Ibrahima Gold Service" className="h-full w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8c9a96]">IGS Logistics & Dédouanement Guinée</p>
          <h1 className="mt-2 font-[Georgia] text-2xl font-bold tracking-tight text-[#102c26]">Espace Opérationnel & Sécurisé</h1>
          <p className="mt-2 text-xs leading-5 text-[#66736f]">
            Plateforme complète de pilotage transit maritime (Port de Conakry, Kamsar), dédouanement SYDONIA, DDI GUCEG, facturation GNF/USD et suivi des dossiers.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2.5 text-left">
            <button
              onClick={() => handleAccess("admin")}
              disabled={isSigningIn}
              className="flex flex-col rounded-xl border border-emerald-900/15 bg-white p-3.5 shadow-sm transition hover:border-[#d9a94b] hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-emerald-950">Administrateur</span>
                <Badge className="bg-emerald-900 text-white text-[10px]">Tous droits</Badge>
              </div>
              <span className="mt-1 text-[11px] text-muted-foreground">Accès complet, contrôle & suppression</span>
            </button>

            <button
              onClick={() => handleAccess("declarant")}
              disabled={isSigningIn}
              className="flex flex-col rounded-xl border border-emerald-900/15 bg-white p-3.5 shadow-sm transition hover:border-[#d9a94b] hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-emerald-950">Déclarant PAC</span>
                <Badge variant="outline" className="text-emerald-800 border-emerald-800 text-[10px]">Opérations</Badge>
              </div>
              <span className="mt-1 text-[11px] text-muted-foreground">Saisie SYDONIA, DDI, BAE et BL</span>
            </button>

            <button
              onClick={() => handleAccess("comptable")}
              disabled={isSigningIn}
              className="flex flex-col rounded-xl border border-emerald-900/15 bg-white p-3.5 shadow-sm transition hover:border-[#d9a94b] hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-emerald-950">Comptable</span>
                <Badge variant="outline" className="text-amber-800 border-amber-800 text-[10px]">Finances</Badge>
              </div>
              <span className="mt-1 text-[11px] text-muted-foreground">Facturation GNF/USD, surestaries, marges</span>
            </button>

            <button
              onClick={() => handleAccess("client")}
              disabled={isSigningIn}
              className="flex flex-col rounded-xl border border-emerald-900/15 bg-white p-3.5 shadow-sm transition hover:border-[#d9a94b] hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-emerald-950">Portail Client</span>
                <Badge variant="outline" className="text-blue-800 border-blue-800 text-[10px]">Birimian Gold</Badge>
              </div>
              <span className="mt-1 text-[11px] text-muted-foreground">Vue filtrée et suivi direct sans appel</span>
            </button>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <a
              href="/portail-client"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <Globe size={14} /> Accéder au portail public par code de suivi BL
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <LayoutContent setSidebarWidth={setSidebarWidth}>{children}</LayoutContent>
    </SidebarProvider>
  );
}

function LayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout, login } = useAuth();
  const perms = usePermissions();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";

  const userRole = perms.role;
  const visibleMenuItems = allMenuItems.filter(item => !item.roles || item.roles.includes(userRole));
  const active = visibleMenuItems.find(item => item.path === location || (item.path !== "/" && location.startsWith(item.path)));

  const utils = trpc.useUtils();
  const [alertFilter, setAlertFilter] = useState<"all" | "surestaries" | "eta" | "douane">("all");
  const notificationsQuery = trpc.notification.list.useQuery(undefined, { refetchInterval: 30000 });
  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter(n => n.isRead === 0).length;
  
  const markReadMutation = trpc.notification.markAsRead.useMutation({
    onMutate: async ({ id }) => {
      await utils.notification.list.cancel();
      const previousNotifications = utils.notification.list.getData();
      utils.notification.list.setData(undefined, old => {
        if (!old) return old;
        return old.map(n => (n.id === id ? { ...n, isRead: 1 } : n));
      });
      return { previousNotifications };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotifications) {
        utils.notification.list.setData(undefined, context.previousNotifications);
      }
      toast.error("Erreur lors de la mise à jour de l'alerte");
    },
    onSettled: () => {
      utils.notification.list.invalidate();
    },
  });

  const markAllReadMutation = trpc.notification.markAllAsRead.useMutation({
    onMutate: async () => {
      await utils.notification.list.cancel();
      const previousNotifications = utils.notification.list.getData();
      utils.notification.list.setData(undefined, old => {
        if (!old) return old;
        return old.map(n => ({ ...n, isRead: 1 }));
      });
      return { previousNotifications };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotifications) {
        utils.notification.list.setData(undefined, context.previousNotifications);
      }
      toast.error("Erreur lors de la mise à jour des alertes");
    },
    onSuccess: () => {
      toast.success("Toutes les alertes ont été marquées comme lues.");
    },
    onSettled: () => {
      utils.notification.list.invalidate();
    },
  });

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (alertFilter === "surestaries") return n.type === "SURESTARIES_RISQUE";
      if (alertFilter === "eta") return n.type === "ETA_DEPASSEE";
      if (alertFilter === "douane") return n.type === "DDI_MANQUANTE" || n.type === "BULLETIN_MANQUANT";
      return true;
    });
  }, [notifications, alertFilter]);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("admin@igs-logistics.gn");
  const [loginPassword, setLoginPassword] = useState("IgsTransit2026!");

  const loginWithPasswordMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: loggedUser => {
      toast.success(`Authentification réussie : ${loggedUser.name}`);
      setLoginModalOpen(false);
      const targetPerms = resolvePermissions(loggedUser.role as Role);
      setLocation(targetPerms.defaultRoute);
      window.location.reload();
    },
    onError: err => {
      toast.error(err.message || "Identifiants invalides");
    },
  });

  const switchRole = async (role: "admin" | "declarant" | "comptable" | "manager" | "client") => {
    let name = "Ibrahima Gold Service (Admin)";
    if (role === "declarant") name = "Mamadou Diallo (Déclarant PAC)";
    if (role === "comptable") name = "Fatoumata Camara (Comptable)";
    if (role === "client") name = "Guinean Birimian Gold S.A";
    if (role === "manager") name = "Alpha Barry (Manager Opérations)";

    await login({ role, name });
    const targetPerms = resolvePermissions(role);
    setLocation(targetPerms.defaultRoute);
    toast.success(`Profil activé : ${targetPerms.roleBadge}`);
  };

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const up = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handlePrefetch = (path: string) => {
    try {
      if (path === "/") {
        utils.dashboard.get.prefetch();
      }
      if (path === "/dossiers") {
        import("../pages/DossiersPage");
        utils.dossier.list.prefetch({});
      }
      if (path === "/planning") {
        import("../pages/PlanningPage");
        utils.dossier.list.prefetch({});
        utils.task.list.prefetch();
      }
      if (path === "/finances") {
        import("../pages/FinancesPage");
        utils.dossier.list.prefetch({});
        utils.invoice.list.prefetch();
      }
      if (path === "/controles") {
        import("../pages/ControlsPage");
        utils.dossier.list.prefetch({});
      }
      if (path === "/portail-client") {
        import("../pages/ClientPortalPage");
      }
    } catch {
      // Ignorer si déjà en cache
    }
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-[#0b2923] text-white" disableTransition={isResizing}>
          <SidebarHeader className="h-[86px] justify-center px-3 border-b border-white/10">
            <div className="flex items-center gap-3 overflow-hidden">
              <button
                onClick={toggleSidebar}
                aria-label="Réduire le menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              >
                <PanelLeft size={18} />
              </button>
              {!isCollapsed && (
                <div className="min-w-0 flex items-center py-1">
                  <img src={IGS_LOGO_SIDEBAR} alt="IGS — Ibrahima Gold Service" className="h-11 w-auto object-contain" />
                </div>
              )}
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-3 pt-4">
            <div className="mb-3 px-2 flex items-center justify-between group-data-[collapsible=icon]:hidden">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7aa195]">
                Espace SaaS Pro
              </span>
              <Badge variant="outline" className="border-[#d9a94b] text-[#d9a94b] text-[10px] uppercase font-semibold">
                {perms.roleBadge}
              </Badge>
            </div>

            <SidebarMenu className="gap-1">
              {visibleMenuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={active?.path === item.path}
                    onClick={() => setLocation(item.path)}
                    onMouseEnter={() => handlePrefetch(item.path)}
                    onFocus={() => handlePrefetch(item.path)}
                    tooltip={item.label}
                    className="h-10 rounded-xl text-[#d7e7e0] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#d9a94b] data-[active=true]:text-[#152d27]"
                  >
                    <item.icon size={17} />
                    <span className="font-medium text-xs">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            <div className="mx-1 mt-6 rounded-2xl border border-white/10 bg-white/[0.05] p-3 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-2 text-[#d9a94b]">
                <ClipboardCheck size={15} />
                <span className="text-xs font-semibold">Douane Guinée & PAC</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-[#afc8bf]">
                Conakry Autonome, SYDONIA World, DDI GUCEG, Devises GNF/USD et gestion documentaire active.
              </p>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/15">
                    <AvatarFallback className="bg-[#1b5145] text-xs font-bold text-white">
                      {user?.name?.charAt(0).toUpperCase() || "I"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden flex-1">
                    <p className="truncate text-xs font-semibold text-white">{user?.name || "Utilisateur IGS"}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[#91b7aa] capitalize">
                      {perms.roleBadge}
                    </p>
                  </div>
                  <UserCheck size={14} className="text-[#91b7aa] group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-semibold">Changer de rôle (Simulateur)</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => switchRole("admin")} className="text-xs cursor-pointer">
                  👑 Administrateur
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchRole("declarant")} className="text-xs cursor-pointer">
                  📦 Déclarant PAC (Mamadou Diallo)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchRole("comptable")} className="text-xs cursor-pointer">
                  💰 Comptable (Fatoumata Camara)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchRole("client")} className="text-xs cursor-pointer">
                  🏢 Client (Guinean Birimian Gold)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLoginModalOpen(true)} className="text-xs cursor-pointer text-emerald-950 font-semibold">
                  <Lock className="mr-2 h-3.5 w-3.5 text-emerald-700" />
                  Connexion Mot de passe
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive text-xs">
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize hover:bg-[#d9a94b]/50"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset className="relative isolate overflow-hidden bg-[#f5f7f6]">
        {/* Barre supérieure permanente avec alertes et notifications proactives */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#e4ebe8] bg-white/90 px-4 sm:px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            {isMobile && <SidebarTrigger />}
            <span className="font-semibold text-sm text-[#15362e] hidden sm:inline">{active?.label || "IGS Suivi"}</span>
            {user?.role === "client" && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                Espace Client : {user.clientCompany || "Société"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Cloche de notifications proactives */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-emerald-50">
                  <Bell size={18} className="text-[#102c26]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-88 sm:w-96 p-0 shadow-2xl border-emerald-950/15 rounded-2xl bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3 bg-[#f8faf9]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#102c26]">Alertes Proactives</span>
                    {unreadCount > 0 && (
                      <Badge className="bg-rose-600 text-white text-[10px] px-1.5 py-0 font-bold">
                        {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[11px] font-semibold text-[#18493d] hover:underline"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>

                {/* Filtres par Catégorie */}
                <div className="flex items-center gap-1 px-3 py-2 bg-gray-50/75 border-b text-[11px]">
                  <button
                    onClick={() => setAlertFilter("all")}
                    className={`rounded-lg px-2 py-0.5 font-medium transition ${alertFilter === "all" ? "bg-[#0b3b32] text-white" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    Toutes ({notifications.length})
                  </button>
                  <button
                    onClick={() => setAlertFilter("surestaries")}
                    className={`rounded-lg px-2 py-0.5 font-medium transition ${alertFilter === "surestaries" ? "bg-[#0b3b32] text-white" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    🚨 Surestaries ({notifications.filter(n => n.type === "SURESTARIES_RISQUE").length})
                  </button>
                  <button
                    onClick={() => setAlertFilter("eta")}
                    className={`rounded-lg px-2 py-0.5 font-medium transition ${alertFilter === "eta" ? "bg-[#0b3b32] text-white" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    ⏱️ ETA ({notifications.filter(n => n.type === "ETA_DEPASSEE").length})
                  </button>
                  <button
                    onClick={() => setAlertFilter("douane")}
                    className={`rounded-lg px-2 py-0.5 font-medium transition ${alertFilter === "douane" ? "bg-[#0b3b32] text-white" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    📄 Douane ({notifications.filter(n => n.type === "DDI_MANQUANTE" || n.type === "BULLETIN_MANQUANT").length})
                  </button>
                </div>

                {/* Liste des alertes avec 1-click drilldown */}
                <div className="max-h-80 overflow-y-auto divide-y">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Aucune alerte dans cette catégorie.</div>
                  ) : (
                    filteredNotifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.dossierId) {
                            setLocation(`/dossiers/${n.dossierId}`);
                          }
                          if (!n.isRead) markReadMutation.mutate({ id: n.id });
                        }}
                        className={`p-3 text-xs transition cursor-pointer hover:bg-emerald-50/60 ${
                          n.isRead ? "bg-gray-50/50 text-muted-foreground opacity-60 hover:opacity-90" : "bg-emerald-50/30 text-emerald-950 font-medium"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#102c26]">{n.title}</span>
                            {n.type === "SURESTARIES_RISQUE" && (
                              <Badge className="bg-rose-100 text-rose-800 text-[9px] px-1 py-0 border-rose-300">
                                Urgent PAC
                              </Badge>
                            )}
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markReadMutation.mutate({ id: n.id });
                              }}
                              className="text-[10px] text-emerald-700 hover:underline shrink-0 font-semibold"
                            >
                              Marquer lu
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-emerald-900/90">{n.message}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Dossier #{n.dossierNumber || n.dossierId}</span>
                          <span className="text-emerald-700 font-semibold hover:underline">Ouvrir fiche ➔</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Bouton "+ Nouveau Dossier" - masqué si pas autorisé */}
            {perms.canCreateDossier && (
              <Button
                onClick={() => setLocation("/dossiers/nouveau")}
                size="sm"
                className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] h-8 text-xs font-medium"
              >
                <Plus size={14} className="mr-1" /> Nouveau Dossier
              </Button>
            )}
          </div>
        </header>

        <main className="relative z-10 min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>

      {/* Modal Authentification Sécurisée par Mot de Passe */}
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-[Georgia] text-xl text-[#102c26] flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-800" />
              Connexion Sécurisée IGS
            </DialogTitle>
            <DialogDescription className="text-xs text-[#627670]">
              Entrez vos identifiants professionnels IGS pour accéder à votre espace de gestion logistique.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={e => {
              e.preventDefault();
              loginWithPasswordMutation.mutate({
                email: loginEmail,
                password: loginPassword,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3a504a]">Adresse Email professionnelle</Label>
              <Input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="admin@igs-logistics.gn"
                className="rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3a504a]">Mot de passe sécurisé</Label>
              <Input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="rounded-xl text-xs"
                required
              />
            </div>

            {/* Comptes Démo Rapides */}
            <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/50 p-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                Identifiants rapides en 1-clic :
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("admin@igs-logistics.gn");
                    setLoginPassword("IgsTransit2026!");
                  }}
                  className="rounded-lg bg-white border border-emerald-200 py-1 px-2 text-emerald-950 font-medium hover:bg-emerald-100/50"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("declarant@igs-logistics.gn");
                    setLoginPassword("IgsTransit2026!");
                  }}
                  className="rounded-lg bg-white border border-emerald-200 py-1 px-2 text-emerald-950 font-medium hover:bg-emerald-100/50"
                >
                  Déclarant PAC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail("comptable@igs-logistics.gn");
                    setLoginPassword("IgsTransit2026!");
                  }}
                  className="rounded-lg bg-white border border-emerald-200 py-1 px-2 text-emerald-950 font-medium hover:bg-emerald-100/50"
                >
                  Comptable
                </button>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLoginModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loginWithPasswordMutation.isPending}
                className="rounded-xl bg-[#0b3b32] text-white text-xs h-9 px-4 font-semibold"
              >
                {loginWithPasswordMutation.isPending ? "Connexion..." : "Se connecter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
