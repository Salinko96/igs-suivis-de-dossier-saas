import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Anchor,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Ship,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function PlanningPage() {
  const [, setLocation] = useLocation();
  const dossiersQuery = trpc.dossier.list.useQuery();
  const tasksQuery = trpc.task.list.useQuery();
  const [filterMode, setFilterMode] = useState<"all" | "overdue" | "upcoming">("all");

  const dossiers = dossiersQuery.data || [];
  const tasks = tasksQuery.data || [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const planningItems = useMemo(() => {
    return dossiers
      .filter(d => d.eta)
      .map(d => {
        const etaDate = new Date(d.eta!);
        const isPast = etaDate < now;
        const daysDiff = Math.round((etaDate.getTime() - now.getTime()) / 86400000);
        return {
          ...d,
          etaDate,
          isPast,
          daysDiff,
        };
      })
      .filter(item => {
        if (filterMode === "overdue") return item.isPast && !item.goodsReleaseDate;
        if (filterMode === "upcoming") return !item.isPast && !item.goodsReleaseDate;
        return true;
      })
      .sort((a, b) => a.etaDate.getTime() - b.etaDate.getTime());
  }, [dossiers, filterMode]);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* En-tête Planning */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[Georgia] text-2xl sm:text-3xl font-bold tracking-tight text-[#102c26]">
              Planning des Arrivées & Échéances
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#627670]">
              Vue chronologique des ETA des navires (Port de Conakry, Kamsar) et des échéances de dédouanement.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
            <Button
              variant={filterMode === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterMode("all")}
              className={`rounded-lg text-xs h-8 ${filterMode === "all" ? "bg-[#0b3b32] text-white" : ""}`}
            >
              Tous ({dossiers.filter(d => d.eta).length})
            </Button>
            <Button
              variant={filterMode === "upcoming" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterMode("upcoming")}
              className={`rounded-lg text-xs h-8 ${filterMode === "upcoming" ? "bg-[#0b3b32] text-white" : ""}`}
            >
              À Venir
            </Button>
            <Button
              variant={filterMode === "overdue" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterMode("overdue")}
              className={`rounded-lg text-xs h-8 text-rose-700 ${filterMode === "overdue" ? "bg-rose-700 text-white" : ""}`}
            >
              Arrivés / En retard
            </Button>
          </div>
        </div>

        {/* Timeline des Arrivées */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">Calendrier Chronologique des ETA</h2>
            
            <div className="space-y-3">
              {planningItems.length === 0 ? (
                <Card className="p-8 text-center border-dashed bg-white">
                  <CalendarIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">Aucun dossier correspondant pour ce filtre.</p>
                </Card>
              ) : (
                planningItems.map(item => (
                  <Card
                    key={item.id}
                    onClick={() => setLocation(`/dossiers/${item.id}`)}
                    className="cursor-pointer border border-emerald-950/10 bg-white p-4.5 shadow-sm hover:border-[#d9a94b] transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#102c26]">{item.dossierNumber}</span>
                          <span className="text-xs font-semibold text-emerald-900">• {item.client}</span>
                          <Badge className={item.calculatedStatus === "Régularisé" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                            {item.calculatedStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Ship size={13} className="text-emerald-800" /> {item.originPort || "Origine"} ➔ {item.destinationPort || "Conakry"}
                          </span>
                          <span>•</span>
                          <span>BL: {item.blLtaNumber}</span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div className="flex items-center sm:justify-end gap-1.5 font-bold text-xs text-[#102c26]">
                          <Clock size={13} className={item.isPast ? "text-rose-600" : "text-emerald-700"} />
                          ETA : {item.etaDate.toLocaleDateString("fr-FR")}
                        </div>
                        <p className={`text-[11px] font-medium mt-0.5 ${item.isPast ? "text-rose-600" : "text-emerald-700"}`}>
                          {item.isPast ? `Arrivé il y a ${Math.abs(item.daysDiff)} jours` : `Dans ${item.daysDiff} jours`}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Colonne Tâches & Échéances */}
          <div className="space-y-3">
            <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">Tâches Opérationnelles Assignées</h2>
            <Card className="border border-emerald-950/10 bg-white p-4 shadow-sm space-y-3">
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Toutes les tâches sont terminées.</p>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-emerald-950">
                      <span>{t.title}</span>
                      <Badge variant="outline" className="text-[10px]">{t.status.replace("_", " ")}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>👤 {t.assignedTo}</span>
                      <span>📅 {t.dueDate ? new Date(t.dueDate).toLocaleDateString("fr-FR") : "Immédiat"}</span>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
