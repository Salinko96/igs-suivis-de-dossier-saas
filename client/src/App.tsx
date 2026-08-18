import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const DossiersPage = lazy(() => import("./pages/DossiersPage"));
const DossierDetailPage = lazy(() => import("./pages/DossierDetailPage"));
const FinancesPage = lazy(() => import("./pages/FinancesPage"));
const PlanningPage = lazy(() => import("./pages/PlanningPage"));
const ControlsPage = lazy(() => import("./pages/ControlsPage"));
const ClientPortalPage = lazy(() => import("./pages/ClientPortalPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f5f7f6]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#1d7764] border-t-transparent" />
        <span className="text-xs font-medium text-[#7a8a85]">Chargement de votre espace IGS...</span>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dossiers" component={DossiersPage} />
        <Route path="/dossiers/nouveau" component={DossierDetailPage} />
        <Route path="/dossiers/:id" component={DossierDetailPage} />
        <Route path="/finances" component={FinancesPage} />
        <Route path="/planning" component={PlanningPage} />
        <Route path="/controles" component={ControlsPage} />
        <Route path="/portail-client" component={ClientPortalPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
