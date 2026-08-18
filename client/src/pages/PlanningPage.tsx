import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertCircle,
  Anchor,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  ListTodo,
  Loader2,
  MapPin,
  Plus,
  Ship,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function PlanningPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const perms = usePermissions();
  const utils = trpc.useUtils();

  const dossiersQuery = trpc.dossier.list.useQuery();
  const tasksQuery = trpc.task.list.useQuery();

  const [filterMode, setFilterMode] = useState<"all" | "overdue" | "upcoming">("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | "pending" | "completed">("all");

  // Create Task Modal State
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTaskDossierId, setNewTaskDossierId] = useState<number | undefined>();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("Mamadou Diallo");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"Haute" | "Normale" | "Basse">("Normale");

  const toggleTaskStatusMutation = trpc.task.toggleStatus.useMutation({
    onSuccess: (updated) => {
      toast.success(
        updated.status === "Termine"
          ? `Tâche "${updated.title}" marquée comme terminée !`
          : `Tâche "${updated.title}" réouverte.`
      );
      utils.task.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Erreur : ${err.message}`);
    },
  });

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Nouvelle tâche opérationnelle créée !");
      setCreateTaskOpen(false);
      setNewTaskTitle("");
      setNewTaskDueDate("");
      utils.task.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Erreur lors de la création : ${err.message}`);
    },
  });

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

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Filter by assignee
      if (taskAssigneeFilter === "mamadou") {
        if (!t.assignedTo?.toLowerCase().includes("mamadou")) return false;
      } else if (taskAssigneeFilter === "fatoumata") {
        if (!t.assignedTo?.toLowerCase().includes("fatoumata")) return false;
      } else if (taskAssigneeFilter === "alpha") {
        if (!t.assignedTo?.toLowerCase().includes("alpha")) return false;
      }

      // Filter by status
      if (taskStatusFilter === "pending" && t.status === "Termine") return false;
      if (taskStatusFilter === "completed" && t.status !== "Termine") return false;

      return true;
    });
  }, [tasks, taskAssigneeFilter, taskStatusFilter]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDossierId) {
      toast.error("Veuillez sélectionner un dossier concerné");
      return;
    }
    if (!newTaskTitle.trim()) {
      toast.error("Veuillez saisir un intitulé de tâche");
      return;
    }

    createTaskMutation.mutate({
      dossierId: newTaskDossierId,
      title: newTaskTitle.trim(),
      assignedTo: newTaskAssignedTo,
      dueDate: newTaskDueDate ? new Date(`${newTaskDueDate}T00:00:00Z`) : null,
      priority: newTaskPriority,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* En-tête Planning */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d9a94b]">
                Opérations Terrain & Échéances
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-800 text-emerald-900">
                Port Autonome de Conakry
              </Badge>
            </div>
            <h1 className="mt-1 font-[Georgia] text-2xl sm:text-3xl font-bold tracking-tight text-[#102c26]">
              Planning des Arrivées & Check-list Terrain
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#627670]">
              Pilotage des ETA des navires, suivi des échéances SYDONIA / BLD et répartition des tâches opérationnelles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre ETA */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
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
                Arrivés / Retard
              </Button>
            </div>

            {/* Bouton Nouvelle Tâche */}
            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs shadow-sm">
                  <Plus size={15} className="mr-1.5" /> Nouvelle Tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-[Georgia] text-xl text-[#102c26]">
                    Créer une tâche opérationnelle
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#627670]">
                    Assignez une action de dédouanement (visite, liquidation, BAE, PAC) à un opérateur.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-3.5 py-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#3a504a]">Dossier concerné *</Label>
                    <select
                      value={newTaskDossierId || ""}
                      onChange={e => setNewTaskDossierId(Number(e.target.value))}
                      className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs"
                      required
                    >
                      <option value="">Sélectionner un dossier...</option>
                      {dossiers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.dossierNumber} — {d.client} ({d.blLtaNumber || "Sans BL"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#3a504a]">Intitulé de la tâche *</Label>
                    <Input
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="ex: Déposer le BL original au guichet Conakry Terminal"
                      className="h-9 rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Assigné à</Label>
                      <select
                        value={newTaskAssignedTo}
                        onChange={e => setNewTaskAssignedTo(e.target.value)}
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-2 text-xs"
                      >
                        <option value="Mamadou Diallo">Mamadou Diallo (Déclarant)</option>
                        <option value="Fatoumata Camara">Fatoumata Camara (Comptable)</option>
                        <option value="Alpha Barry">Alpha Barry (Manager)</option>
                        <option value="Ibrahima Gold Service">Équipe Transit IGS</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Priorité</Label>
                      <select
                        value={newTaskPriority}
                        onChange={e => setNewTaskPriority(e.target.value as any)}
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-2 text-xs"
                      >
                        <option value="Haute">🔴 Haute</option>
                        <option value="Normale">🟡 Normale</option>
                        <option value="Basse">🟢 Basse</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#3a504a]">Date d'échéance</Label>
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={e => setNewTaskDueDate(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="submit"
                      disabled={createTaskMutation.isPending}
                      className="w-full rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs h-9"
                    >
                      {createTaskMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                      Enregistrer la tâche
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Grille principale : Timeline des Arrivées + Checklist Tâches */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Colonne Gauche (7 cols) : Timeline Chronologique des ETA */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">
                  Calendrier Chronologique des ETA Navires
                </h2>
                <p className="text-xs text-muted-foreground">Arrivées maritimes et statuts d'enlèvement quai.</p>
              </div>
              <Badge variant="outline" className="border-emerald-800 text-emerald-900 text-xs">
                {planningItems.length} navire(s)
              </Badge>
            </div>

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
                    className="cursor-pointer border border-emerald-950/10 bg-white p-4 shadow-sm hover:border-[#d9a94b] transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#102c26]">{item.dossierNumber}</span>
                          <span className="text-xs font-semibold text-emerald-900">• {item.client}</span>
                          <Badge className={item.calculatedStatus === "Régularisé" ? "bg-emerald-100 text-emerald-800 text-[10px]" : "bg-amber-100 text-amber-800 text-[10px]"}>
                            {item.calculatedStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Ship size={13} className="text-emerald-800" /> {item.originPort || "Origine"} ➔ {item.destinationPort || "Conakry"}
                          </span>
                          <span>•</span>
                          <span className="font-mono">BL: {item.blLtaNumber || "—"}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>Marchandise : <strong>{item.cargoNature || "Fret maritime"}</strong></span>
                          {item.container && <span>({item.container})</span>}
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0 bg-gray-50/75 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                        <div className="flex items-center sm:justify-end gap-1.5 font-bold text-xs text-[#102c26]">
                          <Clock size={13} className={item.isPast ? "text-rose-600" : "text-emerald-700"} />
                          ETA : {item.etaDate.toLocaleDateString("fr-FR")}
                        </div>
                        <p className={`text-[11px] font-medium mt-0.5 ${item.isPast ? "text-rose-600 font-semibold" : "text-emerald-700"}`}>
                          {item.isPast ? `Arrivé il y a ${Math.abs(item.daysDiff)} jours` : `Dans ${item.daysDiff} jours`}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Colonne Droite (5 cols) : Interactive Operational Tasks Checklist */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">
                  Check-list & Tâches Terrain
                </h2>
                <p className="text-xs text-muted-foreground">Actions assignées aux déclarants & comptables.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold border-emerald-800 text-emerald-900">
                {tasks.filter(t => t.status !== "Termine").length} en cours
              </Badge>
            </div>

            {/* Filtres des Tâches */}
            <Card className="border border-emerald-950/10 bg-white p-3 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <Filter size={13} /> Filtrer les tâches :
                </span>
              </div>

              {/* Filtre par assigné */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setTaskAssigneeFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    taskAssigneeFilter === "all" ? "bg-[#0b3b32] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Toutes ({tasks.length})
                </button>
                <button
                  onClick={() => setTaskAssigneeFilter("mamadou")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    taskAssigneeFilter === "mamadou" ? "bg-[#0b3b32] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  📦 Mamadou Diallo ({tasks.filter(t => t.assignedTo?.toLowerCase().includes("mamadou")).length})
                </button>
                <button
                  onClick={() => setTaskAssigneeFilter("fatoumata")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    taskAssigneeFilter === "fatoumata" ? "bg-[#0b3b32] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  💰 Fatoumata ({tasks.filter(t => t.assignedTo?.toLowerCase().includes("fatoumata")).length})
                </button>
              </div>

              {/* Filtre par statut */}
              <div className="flex items-center gap-1.5 pt-1 text-xs">
                <span className="text-[11px] text-muted-foreground mr-1">Statut :</span>
                <button
                  onClick={() => setTaskStatusFilter("all")}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    taskStatusFilter === "all" ? "bg-emerald-100 text-emerald-900 font-bold" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setTaskStatusFilter("pending")}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    taskStatusFilter === "pending" ? "bg-amber-100 text-amber-900 font-bold" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  À faire ({tasks.filter(t => t.status !== "Termine").length})
                </button>
                <button
                  onClick={() => setTaskStatusFilter("completed")}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    taskStatusFilter === "completed" ? "bg-emerald-100 text-emerald-900 font-bold" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Terminées ({tasks.filter(t => t.status === "Termine").length})
                </button>
              </div>
            </Card>

            {/* Liste Interactive des Tâches */}
            <div className="space-y-2.5">
              {filteredTasks.length === 0 ? (
                <Card className="p-6 text-center border-dashed bg-white">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600/40" />
                  <p className="mt-2 text-xs font-medium text-muted-foreground">Aucune tâche ne correspond à ces filtres.</p>
                </Card>
              ) : (
                filteredTasks.map(t => {
                  const isDone = t.status === "Termine";
                  return (
                    <Card
                      key={t.id}
                      className={`p-3.5 border transition ${
                        isDone
                          ? "bg-emerald-50/30 border-emerald-200/50 opacity-80"
                          : "bg-white border-emerald-950/10 hover:border-[#d9a94b]/60 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleTaskStatusMutation.mutate({ id: t.id })}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0b3b32] focus:ring-[#0b3b32] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-xs text-emerald-950 leading-snug ${
                              isDone ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {t.title}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                            <span className="font-medium text-[#18493d] flex items-center gap-1">
                              <UserCheck size={11} /> {t.assignedTo || "Opérateur IGS"}
                            </span>
                            <span className="flex items-center gap-1">
                              📅 {t.dueDate ? new Date(t.dueDate).toLocaleDateString("fr-FR") : "Immédiat"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${
                            t.priority === "Haute"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.priority} Priorité
                        </Badge>
                        <button
                          onClick={() => setLocation(`/dossiers/${t.dossierId}`)}
                          className="text-[10px] text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 font-medium"
                        >
                          Dossier #{t.dossierId} <ExternalLink size={10} />
                        </button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
