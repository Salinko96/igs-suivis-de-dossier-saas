import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ControlsPage from "./pages/ControlsPage";
import DossierDetailPage from "./pages/DossierDetailPage";
import DossiersPage from "./pages/DossiersPage";
import FinancesPage from "./pages/FinancesPage";
import PlanningPage from "./pages/PlanningPage";
import ClientPortalPage from "./pages/ClientPortalPage";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function Router() {
  return (
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
