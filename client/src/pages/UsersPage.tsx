import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  Anchor,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Edit2,
  Mail,
  MoreVertical,
  Phone,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type UserRole = "admin" | "declarant" | "comptable" | "client" | "manager" | "user";

interface UserItem {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  clientCompany: string | null;
  phone: string | null;
  isActive: boolean;
  sessionRevokedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastSignedIn: Date | string;
}

export default function UsersPage() {
  const utils = trpc.useUtils();

  // Queries
  const hrStatsQuery = trpc.user.getHRStats.useQuery(undefined, {
    staleTime: 10_000,
  });
  const usersQuery = trpc.user.list.useQuery(undefined, {
    staleTime: 10_000,
  });
  const clientsListQuery = trpc.reference.list.useQuery({ category: "client" });

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("+224 ");
  const [formRole, setFormRole] = useState<UserRole>("declarant");
  const [formClientCompany, setFormClientCompany] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Mutations
  const createUserMutation = trpc.user.create.useMutation({
    onSuccess: (newUser) => {
      toast.success(`Collaborateur ${newUser.name} créé avec succès`);
      utils.user.list.invalidate();
      utils.user.getHRStats.invalidate();
      setModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(`Erreur création : ${err.message}`);
    },
  });

  const updateUserMutation = trpc.user.update.useMutation({
    onSuccess: (updated) => {
      toast.success(`Profil de ${updated.name} mis à jour`);
      utils.user.list.invalidate();
      utils.user.getHRStats.invalidate();
      setModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(`Erreur mise à jour : ${err.message}`);
    },
  });

  const toggleStatusMutation = trpc.user.toggleStatus.useMutation({
    onSuccess: (user) => {
      if (user.isActive) {
        toast.success(`Compte réactivé : ${user.name}`);
      } else {
        toast.warning(`Session révoquée et compte suspendu : ${user.name}`);
      }
      utils.user.list.invalidate();
      utils.user.getHRStats.invalidate();
    },
    onError: (err) => {
      toast.error(`Erreur changement de statut : ${err.message}`);
    },
  });

  const resetForm = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("+224 ");
    setFormRole("declarant");
    setFormClientCompany("");
    setFormIsActive(true);
  };

  const handleOpenCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormName(user.name || "");
    setFormEmail(user.email || "");
    setFormPhone(user.phone || "+224 ");
    setFormRole(user.role);
    setFormClientCompany(user.clientCompany || "");
    setFormIsActive(user.isActive !== false);
    setModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Le nom du collaborateur est requis");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      toast.error("Une adresse email valide est requise");
      return;
    }

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
        role: formRole,
        clientCompany: formRole === "client" ? formClientCompany.trim() || null : null,
        isActive: formIsActive,
      });
    } else {
      createUserMutation.mutate({
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
        role: formRole,
        clientCompany: formRole === "client" ? formClientCompany.trim() || null : null,
        isActive: formIsActive,
      });
    }
  };

  const handleToggleStatus = (user: UserItem, newStatus: boolean) => {
    toggleStatusMutation.mutate({
      id: user.id,
      isActive: newStatus,
    });
  };

  // Filtered list
  const allUsers = (usersQuery.data || []) as UserItem[];
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const matchSearch =
        !searchTerm.trim() ||
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.phone && u.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.clientCompany && u.clientCompany.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.openId && u.openId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchRole = roleFilter === "all" || u.role === roleFilter;

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.isActive !== false) ||
        (statusFilter === "inactive" && u.isActive === false);

      return matchSearch && matchRole && matchStatus;
    });
  }, [allUsers, searchTerm, roleFilter, statusFilter]);

  const stats = hrStatsQuery.data || {
    totalEmployees: allUsers.length,
    activeDeclarantsAtPort: allUsers.filter((u) => u.role === "declarant" && u.isActive !== false).length,
    activeComptables: allUsers.filter((u) => u.role === "comptable" && u.isActive !== false).length,
    connectedClients: allUsers.filter((u) => u.role === "client" && u.isActive !== false).length,
    totalActive: allUsers.filter((u) => u.isActive !== false).length,
    totalInactive: allUsers.filter((u) => u.isActive === false).length,
  };

  const getRoleBadgeInfo = (role: UserRole) => {
    switch (role) {
      case "admin":
        return { label: "Administrateur", className: "bg-[#0b3b32] text-white border-[#0b3b32]" };
      case "declarant":
        return { label: "Déclarant PAC", className: "bg-teal-700 text-white border-teal-800" };
      case "comptable":
        return { label: "Comptable", className: "bg-amber-700 text-white border-amber-800" };
      case "manager":
        return { label: "Manager Opérations", className: "bg-purple-800 text-white border-purple-900" };
      case "client":
        return { label: "Client Entreprise", className: "bg-sky-700 text-white border-sky-800" };
      default:
        return { label: "Utilisateur", className: "bg-gray-600 text-white" };
    }
  };

  const formatDate = (dateVal: Date | string | null | undefined) => {
    if (!dateVal) return "Jamais";
    try {
      const d = new Date(dateVal);
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return String(dateVal);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "IG";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-950/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <span>Administration Système</span>
              <span>•</span>
              <span>Ressources Humaines & Sécurité</span>
            </div>
            <h1 className="mt-1 font-[Georgia] text-2xl font-bold tracking-tight text-[#0b3b32] sm:text-3xl">
              Gestion des Collaborateurs & RH
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Annuaire centralisé des 100+ agents IGS Transit (PAC, Kamsar, Boffa) et portails clients connectés avec révocation instantanée de session.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                usersQuery.refetch();
                hrStatsQuery.refetch();
                toast.info("Actualisation des collaborateurs...");
              }}
              disabled={usersQuery.isRefetching}
              className="border-emerald-900/20 text-emerald-950 hover:bg-emerald-50 text-xs"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${usersQuery.isRefetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="bg-[#0b3b32] text-white hover:bg-[#166653] shadow-sm text-xs font-medium"
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Nouveau Collaborateur
            </Button>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Effectif Total */}
          <Card className="border border-emerald-900/15 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-900/70">
                  Effectif Total
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-[#0b3b32]">
                    {stats.totalEmployees}
                  </span>
                  <span className="text-xs font-medium text-emerald-700">Collaborateurs</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {stats.totalActive} actifs
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-rose-700 font-medium">
                    <UserX className="h-3 w-3 text-rose-500" /> {stats.totalInactive} inactifs
                  </span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b3b32] text-white shadow-sm">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>

          {/* KPI 2: Déclarants Quai PAC */}
          <Card className="border border-emerald-900/15 bg-gradient-to-br from-white to-teal-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-900/70">
                  Déclarants Quai PAC
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-teal-950">
                    {stats.activeDeclarantsAtPort}
                  </span>
                  <span className="text-xs font-medium text-teal-700">En opération</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Port Autonome Conakry, Kamsar & Boffa
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-800 text-white shadow-sm">
                <Anchor className="h-5 w-5" />
              </div>
            </div>
          </Card>

          {/* KPI 3: Comptables & Finances */}
          <Card className="border border-amber-900/15 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">
                  Comptables & Finance
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-amber-950">
                    {stats.activeComptables}
                  </span>
                  <span className="text-xs font-medium text-amber-700">Gestionnaires</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Facturation GNF/USD & Débours PAC
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </div>
          </Card>

          {/* KPI 4: Portails Clients Connectés */}
          <Card className="border border-sky-900/15 bg-gradient-to-br from-white to-sky-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-900/70">
                  Portails Clients
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-sky-950">
                    {stats.connectedClients}
                  </span>
                  <span className="text-xs font-medium text-sky-700">Sociétés clientes</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Comptes d'accès suivi cargaisons
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-800 text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Controls & Search */}
        <Card className="border border-emerald-900/15 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone (+224), entreprise ou openId..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs border-emerald-900/20 focus-visible:ring-emerald-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Role Filter */}
              <div className="w-44">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="text-xs border-emerald-900/20">
                    <SelectValue placeholder="Tous les rôles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Tous les rôles</SelectItem>
                    <SelectItem value="admin" className="text-xs">Administrateurs</SelectItem>
                    <SelectItem value="declarant" className="text-xs">Déclarants PAC</SelectItem>
                    <SelectItem value="comptable" className="text-xs">Comptables</SelectItem>
                    <SelectItem value="manager" className="text-xs">Managers</SelectItem>
                    <SelectItem value="client" className="text-xs">Portails Clients</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-40">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-xs border-emerald-900/20">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Tous statuts</SelectItem>
                    <SelectItem value="active" className="text-xs">Actifs uniquement</SelectItem>
                    <SelectItem value="inactive" className="text-xs">Inactifs / Suspendus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Button */}
              {(searchTerm || roleFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                  className="text-xs text-muted-foreground hover:text-emerald-950"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-emerald-950/10 pt-2.5 text-xs text-muted-foreground">
            <span>
              Affichage de <strong className="text-emerald-950">{filteredUsers.length}</strong> collaborateur{filteredUsers.length > 1 ? "s" : ""} sur {allUsers.length}
            </span>
            <span className="text-[11px] text-emerald-800 font-medium">
              Synchronisation instantanée RBAC & Révocation JWT
            </span>
          </div>
        </Card>

        {/* 100-Collaborators Table */}
        <Card className="overflow-hidden border border-emerald-900/15 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b3b32]/5 text-[#0b3b32] font-semibold border-b border-emerald-900/10 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 pl-4 pr-3">Collaborateur</th>
                  <th className="px-3 py-3.5">Rôle & Permissions</th>
                  <th className="px-3 py-3.5">Téléphone direct</th>
                  <th className="px-3 py-3.5">Entreprise / Affectation</th>
                  <th className="px-3 py-3.5">Dernière Activité</th>
                  <th className="px-3 py-3.5 text-center">Accès / Session</th>
                  <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/5">
                {usersQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
                        <span className="text-xs">Chargement des 100+ collaborateurs IGS...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <UserX className="h-8 w-8 text-muted-foreground/60" />
                        <p className="text-sm font-semibold text-emerald-950">Aucun collaborateur trouvé</p>
                        <p className="text-xs text-muted-foreground">
                          Modifiez vos critères de recherche ou ajoutez un nouveau profil.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const badge = getRoleBadgeInfo(user.role);
                    const isActive = user.isActive !== false;

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-emerald-50/40 ${!isActive ? "bg-rose-50/30 opacity-75" : ""}`}
                      >
                        {/* Name & Avatar */}
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-8 w-8 border border-emerald-900/15">
                                <AvatarFallback className="bg-[#0b3b32]/10 text-[#0b3b32] text-[11px] font-bold">
                                  {getInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                                  isActive ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                                title={isActive ? "Actif" : "Suspendu / Révocaté"}
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-emerald-950 text-xs truncate max-w-[180px] sm:max-w-[240px]">
                                {user.name || "Sans nom"}
                              </span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-[180px] sm:max-w-[240px]">
                                <Mail className="h-2.5 w-2.5 text-muted-foreground" />
                                {user.email || user.openId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="px-3 py-3">
                          <Badge className={`${badge.className} text-[10px] font-medium shadow-none`}>
                            {badge.label}
                          </Badge>
                        </td>

                        {/* Phone Number */}
                        <td className="px-3 py-3 text-muted-foreground">
                          {user.phone ? (
                            <span className="font-mono text-[11px] text-emerald-900 flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5 text-muted-foreground" />
                              {user.phone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Company / Department */}
                        <td className="px-3 py-3">
                          {user.role === "client" && user.clientCompany ? (
                            <span className="font-medium text-sky-900 text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-sky-700 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{user.clientCompany}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Briefcase className="h-3 w-3 text-emerald-700/60 flex-shrink-0" />
                              {user.role === "declarant"
                                ? "Opérations Quai PAC"
                                : user.role === "comptable"
                                ? "Direction Financière GNF"
                                : user.role === "manager"
                                ? "Direction d'Exploitation"
                                : "Siège IGS Conakry"}
                            </span>
                          )}
                        </td>

                        {/* Last Signed In */}
                        <td className="px-3 py-3 text-muted-foreground text-[11px]">
                          {formatDate(user.lastSignedIn)}
                        </td>

                        {/* Active / Inactive Switch */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => handleToggleStatus(user, checked)}
                              disabled={toggleStatusMutation.isPending}
                              className="data-[state=checked]:bg-[#0b3b32]"
                            />
                            <span
                              className={`text-[10px] font-semibold ${
                                isActive ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              {isActive ? "Actif" : "Suspendu"}
                            </span>
                          </div>
                        </td>

                        {/* Action Menu */}
                        <td className="py-3 pl-3 pr-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-emerald-100/50"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Actions Collaborateur
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(user)}
                                className="cursor-pointer text-xs"
                              >
                                <Edit2 className="mr-2 h-3.5 w-3.5 text-emerald-700" />
                                Modifier le profil
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user, !isActive)}
                                className={`cursor-pointer text-xs ${
                                  isActive ? "text-rose-600 hover:text-rose-700" : "text-emerald-700 hover:text-emerald-800"
                                }`}
                              >
                                <Power className="mr-2 h-3.5 w-3.5" />
                                {isActive ? "Désactiver & Révoquer Session" : "Réactiver le compte"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal Création & Modification Collaborateur */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md bg-white border border-emerald-950/20">
            <form onSubmit={handleSubmitForm}>
              <DialogHeader>
                <DialogTitle className="font-[Georgia] text-lg font-bold text-[#0b3b32]">
                  {editingUser ? "Modifier le Collaborateur" : "Nouveau Collaborateur IGS"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {editingUser
                    ? `Mise à jour des informations, rôle et habilitations de ${editingUser.name}.`
                    : "Création d'un nouvel agent ou profil portail avec attribution de rôle."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-4 text-xs">
                {/* Nom */}
                <div className="space-y-1">
                  <Label htmlFor="userName" className="text-xs font-semibold text-emerald-950">
                    Nom Complet <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="userName"
                    placeholder="Ex: Mamadou Lamarana Diallo"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="text-xs border-emerald-900/20"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <Label htmlFor="userEmail" className="text-xs font-semibold text-emerald-950">
                    Email Professionnel <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="userEmail"
                    type="email"
                    placeholder="Ex: m.diallo@igs-logistics.gn"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    className="text-xs border-emerald-900/20"
                  />
                </div>

                {/* Téléphone direct */}
                <div className="space-y-1">
                  <Label htmlFor="userPhone" className="text-xs font-semibold text-emerald-950">
                    Téléphone Direct (+224)
                  </Label>
                  <Input
                    id="userPhone"
                    placeholder="+224 62x xx xx xx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="text-xs border-emerald-900/20 font-mono"
                  />
                </div>

                {/* Rôle */}
                <div className="space-y-1">
                  <Label htmlFor="userRole" className="text-xs font-semibold text-emerald-950">
                    Rôle Système & Permissions <span className="text-rose-600">*</span>
                  </Label>
                  <Select value={formRole} onValueChange={(val: UserRole) => setFormRole(val)}>
                    <SelectTrigger id="userRole" className="text-xs border-emerald-900/20">
                      <SelectValue placeholder="Sélectionnez un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="declarant" className="text-xs">
                        Déclarant PAC (Saisie SYDONIA, DDI, BAE, BL)
                      </SelectItem>
                      <SelectItem value="comptable" className="text-xs">
                        Comptable (Facturation GNF/USD, Débours, Paiements)
                      </SelectItem>
                      <SelectItem value="manager" className="text-xs">
                        Manager d'Exploitation (Supervision & Validation)
                      </SelectItem>
                      <SelectItem value="client" className="text-xs">
                        Portail Client Externe (Suivi temps réel dédié)
                      </SelectItem>
                      <SelectItem value="admin" className="text-xs">
                        Administrateur (Tous droits, RH & Configuration)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Entreprise Cliente (si rôle client) */}
                {formRole === "client" && (
                  <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
                    <Label htmlFor="clientCompany" className="text-xs font-semibold text-sky-950">
                      Entreprise Cliente Associée <span className="text-rose-600">*</span>
                    </Label>
                    <Input
                      id="clientCompany"
                      placeholder="Ex: Guinean Birimian Gold S.A"
                      value={formClientCompany}
                      onChange={(e) => setFormClientCompany(e.target.value)}
                      required={formRole === "client"}
                      className="text-xs border-sky-300 bg-white"
                    />
                    <p className="text-[10px] text-sky-800">
                      L'utilisateur aura un accès sécurisé restreint aux seuls dossiers de cette société.
                    </p>
                  </div>
                )}

                {/* Statut Actif */}
                <div className="flex items-center justify-between rounded-lg border border-emerald-900/15 p-3 bg-emerald-50/30">
                  <div>
                    <span className="font-semibold text-emerald-950 text-xs">Compte Actif</span>
                    <p className="text-[10px] text-muted-foreground">
                      Si désactivé, l'accès API et la session JWT sont instantanément révoqués.
                    </p>
                  </div>
                  <Switch
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                    className="data-[state=checked]:bg-[#0b3b32]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  className="bg-[#0b3b32] text-white hover:bg-[#166653] text-xs font-medium"
                >
                  {createUserMutation.isPending || updateUserMutation.isPending ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {editingUser ? "Sauvegarder Modifications" : "Créer le Collaborateur"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
