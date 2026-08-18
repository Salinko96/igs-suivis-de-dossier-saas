import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, ClipboardCheck, FolderKanban, LayoutDashboard, Loader2, LogOut, PanelLeft, Plus, ShieldAlert } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Pilotage", path: "/" },
  { icon: FolderKanban, label: "Dossiers", path: "/dossiers" },
  { icon: ShieldAlert, label: "Contrôles", path: "/controles" },
];
const SIDEBAR_WIDTH_KEY = "igs-sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 220;
const MAX_WIDTH = 380;
const IGS_LOGO = "/manus-storage/igs-logo-source_05d3b628.png";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user, login } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);

  const handleAccess = async () => {
    setIsSigningIn(true);
    try {
      if (import.meta.env.VITE_OAUTH_PORTAL_URL) {
        startLogin();
      } else {
        await login({ name: "Ibrahima Gold Service (Admin)", role: "admin" });
      }
    } catch (e) {
      console.error("Login error:", e);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f7f6] px-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-24 w-[42rem] mix-blend-multiply opacity-[0.08]">
          <img src={IGS_LOGO} alt="" className="igs-logo-drift w-full" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-60 -left-56 w-[40rem] mix-blend-multiply opacity-[0.05]">
          <img src={IGS_LOGO} alt="" className="igs-logo-drift igs-logo-drift-delayed w-full" />
        </div>
        <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white/90 p-9 text-center shadow-[0_24px_70px_rgba(20,50,43,0.12)] backdrop-blur-sm">
          <div className="mx-auto mb-5 flex h-20 w-44 items-center justify-center rounded-2xl bg-white p-2">
            <img src={IGS_LOGO} alt="IGS — Ibrahima Gold Service" className="h-full w-full object-contain" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8c9a96]">IGS Dossiers Guinée & Transit</p>
          <h1 className="mt-3 font-[Georgia] text-3xl font-semibold tracking-tight text-[#102c26]">Espace opérationnel</h1>
          <p className="mt-4 text-sm leading-6 text-[#66736f]">
            Plateforme de suivi des dossiers de transit maritime, dédouanement (Port Autonome de Conakry, SYDONIA, DDI) et régularisation.
          </p>
          <Button
            onClick={handleAccess}
            disabled={isSigningIn}
            className="mt-7 h-11 w-full rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41]"
          >
            {isSigningIn ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
            Accéder à l’application
          </Button>
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
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";
  const active = menuItems.find(item => item.path === location || (item.path !== "/" && location.startsWith(item.path)));

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

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-[#0b2923] text-white" disableTransition={isResizing}>
          <SidebarHeader className="h-[86px] justify-center px-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <button
                onClick={toggleSidebar}
                aria-label="Réduire le menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              >
                <PanelLeft size={18} />
              </button>
              {!isCollapsed && (
                <div className="min-w-0 rounded-lg bg-white p-1">
                  <img src={IGS_LOGO} alt="IGS — Ibrahima Gold Service" className="h-10 w-[132px] object-contain" />
                </div>
              )}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 pt-5">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7aa195] group-data-[collapsible=icon]:hidden">
              Navigation
            </p>
            <SidebarMenu className="gap-1">
              {menuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={active?.path === item.path}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className="h-11 rounded-xl text-[#d7e7e0] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#d9a94b] data-[active=true]:text-[#152d27]"
                  >
                    <item.icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <div className="mx-1 mt-8 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-2 text-[#d9a94b]">
                <ClipboardCheck size={16} />
                <span className="text-xs font-semibold">Règles Guinée & PAC</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#afc8bf]">
                Statut et priorité calculés en temps réel d’après la complétude du dossier (SYDONIA / DDI / BL).
              </p>
            </div>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/15">
                    <AvatarFallback className="bg-[#1b5145] text-xs font-bold text-white">
                      {user?.name?.charAt(0).toUpperCase() || "I"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium text-white">{user?.name || "Utilisateur IGS"}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#91b7aa]">Session active</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-56 top-[20rem] z-0 w-[48rem] mix-blend-multiply opacity-[0.026]"
        >
          <img src={IGS_LOGO} alt="" className="igs-logo-drift w-full" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-60 bottom-28 z-0 w-[42rem] mix-blend-multiply opacity-[0.022]"
        >
          <img src={IGS_LOGO} alt="" className="igs-logo-drift igs-logo-drift-delayed w-full" />
        </div>
        {isMobile && (
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#e4ebe8] bg-white/90 px-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="font-semibold text-[#15362e]">{active?.label || "IGS Dossiers"}</span>
            </div>
            <button
              onClick={() => setLocation("/dossiers/nouveau")}
              className="grid h-9 w-9 place-items-center rounded-xl bg-[#0b3b32] text-white"
            >
              <Plus size={17} />
            </button>
          </header>
        )}
        <main className="relative z-10 min-h-screen p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
