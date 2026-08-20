import DashboardLayout from "@/components/DashboardLayout";
import { CustomsEditModal } from "@/components/CustomsEditModal";
import { ConflictResolutionModal, ConflictFieldDiff } from "@/components/ConflictResolutionModal";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Coins,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  History,
  Info,
  ListTodo,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Save,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type FormState = Record<string, string>;

const blank: FormState = {
  clientDossierNumber: "",
  client: "",
  blLtaNumber: "",
  cargoNature: "",
  transportMode: "",
  eta: "",
  originPort: "",
  destinationPort: "",
  container: "",
  bulk: "",
  goodsReleaseDate: "",
  declarationNumber: "",
  bulletinNumber: "",
  finalDeclarationNumber: "",
  ddiGucegNumber: "",
  badStatus: "",
  baeStatus: "",
  documentStatus: "",
  customsStatus: "",
  portStatus: "",
  financialStatus: "",
  fieldOperation: "",
  responsible: "",
  nextAction: "",
  fieldAlert: "",
  deliveryLocation: "",
  declarant: "",
  service: "",
  regime: "",
  notes: "",
};

const dateInput = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const toText = (value: string) => value.trim() || null;
const toDate = (value: string) => (value ? new Date(`${value}T00:00:00Z`) : null);
const pillStyle = (value: string) =>
  value === "Régularisé" || value === "Basse" ? "bg-[#e5f2eb] text-[#186b56]" : "bg-[#fff0eb] text-[#bd5038]";

function Field({
  label,
  field,
  form,
  setForm,
  required = false,
  invalid = false,
  errorMessage,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string;
  field: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  required?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field} className="text-xs font-semibold text-[#516760]">
        {label}
        {required && <span className="ml-1 text-[#c4543e]">*</span>}
      </Label>
      <Input
        id={field}
        type={type}
        value={form[field] || ""}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${field}-error` : undefined}
        onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
        className={`h-10 rounded-xl bg-white text-sm focus-visible:ring-[#2f826d]/30 ${
          invalid ? "border-[#cf5c46] ring-1 ring-[#cf5c46]/20 bg-rose-50/20" : "border-[#dfe9e4]"
        } ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
      />
      {invalid && (
        <p id={`${field}-error`} role="alert" className="text-[11px] font-medium text-[#ba4a36]">
          {errorMessage || "Ce champ est requis."}
        </p>
      )}
    </div>
  );
}

function ReferenceSelectOrInput({
  label,
  field,
  category,
  form,
  setForm,
  references,
  required = false,
  invalid = false,
  errorMessage,
  placeholder,
  disabled = false,
}: {
  label: string;
  field: string;
  category: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  references: Array<{ id: number; category: string; label: string }>;
  required?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const choices = references.filter(item => item.category === category);
  const datalistId = `list-${category}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field} className="text-xs font-semibold text-[#516760]">
        {label}
        {required && <span className="ml-1 text-[#c4543e]">*</span>}
      </Label>
      <div className="relative">
        <input
          id={field}
          list={datalistId}
          value={form[field] || ""}
          disabled={disabled}
          placeholder={placeholder || "Choisir ou saisir…"}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${field}-error` : undefined}
          onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
          className={`h-10 w-full rounded-xl border bg-white px-3 text-sm text-[#365048] outline-none transition focus:ring-2 focus:ring-[#2f826d]/30 ${
            invalid ? "border-[#cf5c46] ring-1 ring-[#cf5c46]/20 bg-rose-50/20" : "border-[#dfe9e4]"
          } ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
        />
        <datalist id={datalistId}>
          {choices.map(choice => (
            <option key={choice.id} value={choice.label} />
          ))}
        </datalist>
      </div>
      {invalid && (
        <p id={`${field}-error`} role="alert" className="text-[11px] font-medium text-[#ba4a36]">
          {errorMessage || "Ce champ est requis."}
        </p>
      )}
    </div>
  );
}

function ReferenceSelect({
  label,
  field,
  category,
  form,
  setForm,
  references,
  required = false,
  invalid = false,
  errorMessage,
  disabled = false,
}: {
  label: string;
  field: string;
  category: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  references: Array<{ id: number; category: string; label: string }>;
  required?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  disabled?: boolean;
}) {
  const choices = references.filter(item => item.category === category);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field} className="text-xs font-semibold text-[#516760]">
        {label}
        {required && <span className="ml-1 text-[#c4543e]">*</span>}
      </Label>
      <select
        id={field}
        value={form[field] || ""}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${field}-error` : undefined}
        onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
        className={`h-10 w-full rounded-xl border bg-white px-3 text-sm text-[#365048] outline-none transition focus:ring-2 focus:ring-[#2f826d]/30 ${
          invalid ? "border-[#cf5c46] ring-1 ring-[#cf5c46]/20 bg-rose-50/20" : "border-[#dfe9e4]"
        } ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
      >
        <option value="">Sélectionner…</option>
        {choices.map(choice => (
          <option key={choice.id} value={choice.label}>
            {choice.label}
          </option>
        ))}
      </select>
      {invalid && (
        <p id={`${field}-error`} role="alert" className="text-[11px] font-medium text-[#ba4a36]">
          {errorMessage || "Ce champ est requis."}
        </p>
      )}
    </div>
  );
}

function DetailContent() {
  const [, params] = useRoute("/dossiers/:id");
  const [location, setLocation] = useLocation();
  const isNew = location === "/dossiers/nouveau";
  const rawId = params?.id;
  const perms = usePermissions();

  const utils = trpc.useUtils();
  const { data: dossier, isLoading, isError, error, refetch } = trpc.dossier.get.useQuery(
    { id: rawId! },
    {
      enabled: !isNew && Boolean(rawId),
      retry: 1,
      placeholderData: () => {
        if (!rawId) return undefined;
        const list = utils.dossier.list.getData();
        if (!list) return undefined;
        const num = Number(rawId);
        return list.find(
          d => d.id === num || d.dossierNumber === rawId || d.portalAccessCode === rawId
        );
      },
    }
  );
  const allDossiersQuery = trpc.dossier.list.useQuery(undefined, {
    staleTime: 30000,
  });
  const { data: references = [] } = trpc.reference.list.useQuery();
  const [form, setForm] = useState<FormState>(blank);
  const [showValidation, setShowValidation] = useState(false);
  const [customsModalOpen, setCustomsModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictDiffs, setConflictDiffs] = useState<ConflictFieldDiff[]>([]);
  const [auditFilter, setAuditFilter] = useState<"all" | "customs" | "finance" | "documents">("all");

  // Onglets & Modales
  const [activeTab, setActiveTab] = useState("general");
  const [newComment, setNewComment] = useState("");
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [newDocType, setNewDocType] = useState<any>("BL");
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [invoiceAmountHt, setInvoiceAmountHt] = useState(15000000);
  const [invoiceCurrency, setInvoiceCurrency] = useState("GNF");
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState(
    perms.isDeclarant ? "Mamadou Diallo" : perms.isComptable ? "Fatoumata Camara" : "Mamadou Diallo"
  );

  // ID numérique résolu du dossier chargé
  const numericId = dossier?.id || (rawId && Number.isFinite(Number(rawId)) ? Number(rawId) : 0);

  // Requêtes additionnelles lazy pour les onglets (chargées uniquement si l'onglet est actif)
  const docsQuery = trpc.document.list.useQuery(
    { dossierId: numericId },
    { enabled: !isNew && Boolean(numericId) && activeTab === "documents" }
  );
  const auditQuery = trpc.audit.list.useQuery(
    { dossierId: numericId },
    { enabled: !isNew && Boolean(numericId) && perms.canViewAudit && activeTab === "audit" }
  );
  const invoicesQuery = trpc.finance.listInvoices.useQuery(
    { dossierId: numericId },
    { enabled: !isNew && Boolean(numericId) && perms.canViewFinances && activeTab === "finances" }
  );
  const tasksQuery = trpc.task.list.useQuery(
    { dossierId: numericId },
    { enabled: !isNew && Boolean(numericId) && activeTab === "tasks" }
  );
  const commentsQuery = trpc.comment.list.useQuery(
    { dossierId: numericId },
    { enabled: !isNew && Boolean(numericId) && activeTab === "tasks" }
  );

  // Mutations
  const uploadDocMutation = trpc.document.uploadBase64.useMutation({
    onSuccess: () => {
      toast.success("Document téléversé et stocké avec succès");
      setUploadDocOpen(false);
      docsQuery.refetch();
      auditQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur de téléversement"),
  });

  const deleteDocMutation = trpc.document.remove.useMutation({
    onSuccess: () => {
      toast.success("Document supprimé");
      docsQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur de suppression"),
  });

  const createInvoiceMutation = trpc.finance.createInvoice.useMutation({
    onSuccess: () => {
      toast.success("Facture émise et enregistrée avec succès");
      setCreateInvoiceOpen(false);
      invoicesQuery.refetch();
      utils.dossier.get.invalidate({ id: rawId! });
    },
    onError: err => toast.error(err.message || "Erreur d'émission de facture"),
  });

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Tâche ajoutée à la check-list");
      setCreateTaskOpen(false);
      setNewTaskTitle("");
      tasksQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur de création de tâche"),
  });

  const updateTaskMutation = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut de la tâche mis à jour");
      tasksQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur de mise à jour"),
  });

  const addCommentMutation = trpc.comment.add.useMutation({
    onSuccess: () => {
      toast.success("Commentaire publié");
      setNewComment("");
      commentsQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur d'envoi du commentaire"),
  });

  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertChannel, setAlertChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [alertPhone, setAlertPhone] = useState("+224 620 00 00 00");
  const [alertEmail, setAlertEmail] = useState("direction@client.gn");
  const [alertMessage, setAlertMessage] = useState("");

  const sendWhatsAppMutation = trpc.notification.sendWhatsApp.useMutation({
    onSuccess: res => {
      toast.success(`Alerte WhatsApp transmise vers ${res.sentTo}`);
      setAlertModalOpen(false);
    },
    onError: err => toast.error(err.message || "Erreur d'envoi WhatsApp"),
  });

  const sendEmailMutation = trpc.notification.sendEmail.useMutation({
    onSuccess: res => {
      toast.success(`Email de notification transmis à ${res.sentTo}`);
      setAlertModalOpen(false);
    },
    onError: err => toast.error(err.message || "Erreur d'envoi de l'email"),
  });

  const updateCustomsQuickMutation = trpc.dossier.updateCustoms.useMutation({
    onSuccess: updated => {
      toast.success(`Statut douanier mis à jour (${updated.dossierNumber})`);
      utils.dossier.get.invalidate({ id: rawId! });
      utils.dossier.list.invalidate();
      auditQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur de mise à jour douanière"),
  });

  useEffect(() => {
    if (!dossier) {
      if (isNew) {
        setForm({
          ...blank,
          transportMode: "Maritime",
          destinationPort: "Port Autonome de Conakry",
          regime: "Mise à la consommation directe (IM4 - TTC)",
        });
      }
      return;
    }
    setForm({
      clientDossierNumber: dossier.clientDossierNumber || "",
      client: dossier.client || "",
      blLtaNumber: dossier.blLtaNumber || "",
      cargoNature: dossier.cargoNature || "",
      transportMode: dossier.transportMode || "",
      eta: dateInput(dossier.eta),
      originPort: dossier.originPort || "",
      destinationPort: dossier.destinationPort || "",
      container: dossier.container || "",
      bulk: dossier.bulk || "",
      goodsReleaseDate: dateInput(dossier.goodsReleaseDate),
      declarationNumber: dossier.declarationNumber || "",
      bulletinNumber: dossier.bulletinNumber || "",
      finalDeclarationNumber: dossier.finalDeclarationNumber || "",
      ddiGucegNumber: dossier.ddiGucegNumber || "",
      badStatus: dossier.badStatus || "",
      baeStatus: dossier.baeStatus || "",
      documentStatus: dossier.documentStatus || "",
      customsStatus: dossier.customsStatus || "",
      portStatus: dossier.portStatus || "",
      financialStatus: dossier.financialStatus || "",
      fieldOperation: dossier.fieldOperation || "",
      responsible: dossier.responsible || "",
      nextAction: dossier.nextAction || "",
      fieldAlert: dossier.fieldAlert || "",
      deliveryLocation: dossier.deliveryLocation || "",
      declarant: dossier.declarant || "",
      service: dossier.service || "",
      regime: dossier.regime || "",
      notes: dossier.notes || "",
    });
  }, [dossier, isNew]);

  const sortedDossiers = useMemo(() => {
    return (allDossiersQuery.data || []).slice().sort((a, b) => b.id - a.id);
  }, [allDossiersQuery.data]);

  const currentIndex = sortedDossiers.findIndex(item => item.id === numericId || item.dossierNumber === rawId);
  const prev = currentIndex > 0 ? sortedDossiers[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < sortedDossiers.length - 1 ? sortedDossiers[currentIndex + 1] : null;

  const createMutation = trpc.dossier.create.useMutation({
    onSuccess: created => {
      toast.success(`Dossier ${created.dossierNumber} créé avec succès`);
      utils.dossier.invalidate();
      utils.dashboard.invalidate();
      setLocation("/dossiers");
    },
    onError: err => toast.error(err.message || "Erreur de création"),
  });

  const buildPayload = () => ({
    clientDossierNumber: toText(form.clientDossierNumber),
    client: toText(form.client),
    blLtaNumber: toText(form.blLtaNumber),
    cargoNature: toText(form.cargoNature),
    transportMode: toText(form.transportMode) || "Maritime",
    eta: toDate(form.eta),
    originPort: toText(form.originPort),
    destinationPort: toText(form.destinationPort),
    container: toText(form.container),
    bulk: toText(form.bulk),
    goodsReleaseDate: toDate(form.goodsReleaseDate),
    declarationNumber: toText(form.declarationNumber),
    bulletinNumber: toText(form.bulletinNumber),
    finalDeclarationNumber: toText(form.finalDeclarationNumber),
    ddiGucegNumber: toText(form.ddiGucegNumber),
    badStatus: toText(form.badStatus),
    baeStatus: toText(form.baeStatus),
    documentStatus: toText(form.documentStatus),
    customsStatus: toText(form.customsStatus),
    portStatus: toText(form.portStatus),
    financialStatus: toText(form.financialStatus),
    fieldOperation: toText(form.fieldOperation),
    responsible: toText(form.responsible),
    nextAction: toText(form.nextAction),
    fieldAlert: toText(form.fieldAlert),
    deliveryLocation: toText(form.deliveryLocation),
    declarant: toText(form.declarant),
    service: toText(form.service),
    regime: toText(form.regime),
    notes: toText(form.notes),
  });

  const updateMutation = trpc.dossier.update.useMutation({
    onSuccess: updated => {
      toast.success(`Dossier ${updated?.dossierNumber} mis à jour avec succès`);
      utils.dossier.invalidate();
      utils.dashboard.invalidate();
      setConflictModalOpen(false);
      setLocation("/dossiers");
    },
    onError: (err, variables) => {
      const isConflict =
        (err as any)?.data?.code === "CONFLICT" ||
        err.message?.toLowerCase().includes("conflit") ||
        (err as any)?.shape?.data?.httpStatus === 409;

      if (isConflict) {
        const diffs: ConflictFieldDiff[] = [];
        const payload = variables.data || buildPayload();
        for (const [k, v] of Object.entries(payload)) {
          const serverVal = (dossier as any)?.[k];
          const localVal = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? String(v) : v;
          const sVal = serverVal instanceof Date ? serverVal.toISOString().slice(0, 10) : typeof serverVal === "boolean" ? String(serverVal) : serverVal;
          if (localVal !== undefined && String(localVal || "") !== String(sVal || "")) {
            diffs.push({
              field: k,
              localValue: localVal,
              serverValue: sVal,
            });
          }
        }
        setConflictDiffs(diffs);
        setConflictModalOpen(true);
        toast.error("Conflit d'édition simultanée : ce dossier a été modifié par un autre collaborateur.");
        return;
      }
      toast.error(err.message || "Erreur de mise à jour");
    },
  });

  const removeMutation = trpc.dossier.remove.useMutation({
    onSuccess: () => {
      toast.success("Dossier supprimé");
      utils.dossier.invalidate();
      utils.dashboard.invalidate();
      setLocation("/dossiers");
    },
    onError: err => toast.error(`Erreur de suppression : ${err.message}`),
  });

  const handleForceOverwrite = () => {
    if (!numericId) return;
    const payload = buildPayload();
    updateMutation.mutate({
      id: numericId,
      forceOverwrite: true,
      data: payload,
    });
  };

  const handleReloadServerData = () => {
    if (rawId) {
      utils.dossier.get.invalidate({ id: rawId });
    }
    utils.dossier.list.invalidate();
    setConflictModalOpen(false);
    toast.info("Données du serveur rechargées.");
  };

  const handleSaveDraft = (event?: React.MouseEvent) => {
    if (event) event.preventDefault();
    if (!form.client?.trim() && !form.clientDossierNumber?.trim() && !form.blLtaNumber?.trim()) {
      setShowValidation(true);
      toast.error("Veuillez renseigner au minimum la référence client, le client ou le N° de connaissement pour enregistrer un brouillon.");
      return;
    }

    const payload = {
      ...buildPayload(),
      isDraft: true,
      calculatedStatus: "Brouillon" as const,
    };
    if (isNew) {
      createMutation.mutate(payload);
    } else if (numericId) {
      updateMutation.mutate({
        id: numericId,
        expectedVersion: dossier?.version,
        expectedUpdatedAt: dossier?.updatedAt,
        data: payload,
      });
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setShowValidation(true);

    const mode = form.transportMode || "Maritime";
    const missing: string[] = [];

    if (!form.clientDossierNumber?.trim()) missing.push("N° dossier client");
    if (!form.client?.trim()) missing.push("Client / Destinataire");
    if (!form.blLtaNumber?.trim()) missing.push(mode === "Aérien" ? "N° LTA" : mode === "Routier" ? "N° Lettre de voiture" : "N° BL Connaissement");
    if (!form.cargoNature?.trim()) missing.push("Nature de marchandise");
    if (!form.eta) missing.push("Date ETA");
    if (!form.originPort?.trim()) missing.push(mode === "Aérien" ? "Aéroport d'origine" : mode === "Routier" ? "Poste frontière départ" : "Port d'origine (POL)");
    if (!form.destinationPort?.trim()) missing.push(mode === "Aérien" ? "Aéroport destination" : mode === "Routier" ? "Poste frontière entrée" : "Port de destination (POD)");
    
    if (mode === "Maritime" && !form.container?.trim() && !form.bulk?.trim()) {
      missing.push("Conteneurs (TC) ou Vrac");
    }

    if (missing.length > 0) {
      toast.error(`Champs obligatoires manquants (${missing.length}) : ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "..." : ""}`, {
        description: "Remplissez les champs marqués en rouge, ou cliquez sur « Sauvegarder en brouillon » pour finaliser plus tard.",
      });
      return;
    }

    const payload = buildPayload();
    if (isNew) {
      createMutation.mutate(payload);
    } else if (numericId) {
      updateMutation.mutate({
        id: numericId,
        expectedVersion: dossier?.version,
        expectedUpdatedAt: dossier?.updatedAt,
        data: payload,
      });
    }
  };

  const handleFileUploadMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !numericId) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Le fichier dépasse la taille maximale autorisée (15 Mo).");
      return;
    }

    toast.info(`Téléversement de "${file.name}" en cours...`);
    const reader = new FileReader();
    reader.onload = () => {
      uploadDocMutation.mutate({
        dossierId: numericId,
        name: file.name,
        type: newDocType,
        base64Content: String(reader.result),
        mimeType: file.type || "application/pdf",
      });
    };
    reader.readAsDataURL(file);
  };

  // 1. ÉTAT DE CHARGEMENT VISUEL (SKELETON + SPINNER IGS)
  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <Skeleton className="h-4 w-96 rounded-lg" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        <Skeleton className="h-11 w-full max-w-2xl rounded-2xl" />

        <div className="relative rounded-2xl border border-[#dfe8e4] bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7f1ed] text-[#1d7764]">
              <Loader2 className="h-7 w-7 animate-spin text-[#1d7764]" />
            </div>
            <h3 className="mt-4 font-[Georgia] text-lg font-bold text-[#173b32]">
              Chargement du dossier logistique...
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[#73847f]">
              Récupération des données maritimes, déclarations Sydonia et pièces jointes depuis le serveur sécurisé IGS.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. ÉTAT D'ERREUR OU DOSSIER INTROUVABLE
  if (!isNew && (isError || (!isLoading && !dossier))) {
    console.error("[DossierDetailPage] Dossier introuvable ou erreur de chargement:", {
      rawId,
      error: error?.message,
    });

    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="rounded-3xl border border-red-100 bg-white p-8 shadow-[0_12px_36px_rgba(200,50,50,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-[Georgia] text-2xl font-bold text-[#1b2f29]">
            Dossier introuvable ou inaccessible
          </h2>
          <p className="mt-2 text-sm text-[#667772]">
            Le dossier avec l'identifiant <strong className="font-mono text-red-700">« {rawId || "inconnu"} »</strong> n'a pas pu être chargé. Il se peut qu'il ait été archivé, supprimé, ou que vos droits d'accès soient restreints.
          </p>
          {error?.message && (
            <div className="mt-4 rounded-xl bg-red-50/70 border border-red-200/60 p-3 text-xs text-red-800 font-medium">
              {error.message.includes("JSON") || error.message.includes("Unexpected token")
                ? "Impossible de joindre le serveur de données. Veuillez vérifier votre connexion ou réessayer."
                : error.message}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setLocation("/dossiers")}
              className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] px-5"
            >
              <ArrowLeft size={16} className="mr-2" /> Retour à la liste des dossiers
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="rounded-xl border-[#dfe8e4] text-[#2b4c42] hover:bg-[#edf5f1]"
            >
              <RotateCcw size={16} className="mr-2" /> Réessayer
            </Button>
            {perms.canCreateDossier && (
              <Button
                variant="outline"
                onClick={() => setLocation("/dossiers/nouveau")}
                className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <Plus size={16} className="mr-2" /> Créer un nouveau dossier
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Fil d'Ariane & Retour rapide */}
      <Breadcrumbs
        items={
          isNew
            ? [
                { label: "Accueil", href: "/" },
                { label: "Tous les Dossiers", href: "/dossiers" },
                { label: "Nouveau dossier", active: true },
              ]
            : [
                { label: "Accueil", href: "/" },
                { label: "Tous les Dossiers", href: "/dossiers" },
                {
                  label: dossier?.dossierNumber
                    ? `Fiche ${dossier.dossierNumber}`
                    : rawId
                    ? `Fiche ${rawId}`
                    : "Fiche Dossier",
                  active: true,
                },
              ]
        }
        backHref="/dossiers"
      />

      {/* En-tête du Dossier */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dossiers")}
            className="rounded-xl border border-[#dfe8e4] bg-white text-[#3f5a52] hover:bg-[#ebf3f0]"
          >
            <ArrowLeft size={16} className="mr-1.5" /> Retour
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[Georgia] text-2xl font-bold tracking-tight text-[#112f28]">
                {isNew ? "Nouveau dossier logistique & transit" : `Dossier ${dossier?.dossierNumber}`}
              </h1>
              {!isNew && dossier && (
                <Badge className={pillStyle(dossier.calculatedStatus)}>
                  {dossier.calculatedStatus === "Régularisé" ? <Check size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                  {dossier.calculatedStatus}
                </Badge>
              )}
            </div>
            {!isNew && dossier && (
              <p className="mt-0.5 text-xs text-[#73847f]">
                Client : <strong className="text-[#20473e]">{dossier.client || "Non renseigné"}</strong> • BL :{" "}
                <strong className="text-[#20473e]">{dossier.blLtaNumber || "Non renseigné"}</strong> • Code Portail Client :{" "}
                <Badge variant="outline" className="font-mono text-emerald-800 border-emerald-300">
                  {dossier.portalAccessCode || `IGS-${1000 + dossier.id}`}
                </Badge>
              </p>
            )}
          </div>
        </div>

        {!isNew && dossier && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Action Rapide Douane pour Déclarant & Admin */}
            {perms.canEditCustoms && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomsModalOpen(true)}
                className="rounded-xl border-emerald-800 text-emerald-950 hover:bg-emerald-50 text-xs h-9 font-semibold"
              >
                <ShieldAlert size={14} className="mr-1.5 text-emerald-700" />
                Édition Rapide Douane
              </Button>
            )}

            {/* Notification Multi-Canal WhatsApp / Email */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAlertMessage(`Bonjour, le dossier ${dossier.dossierNumber} (BL: ${dossier.blLtaNumber || "N/A"}) pour ${dossier.client || "votre compte"} est actuellement en statut : ${dossier.calculatedStatus}.`);
                setAlertModalOpen(true);
              }}
              className="rounded-xl border-amber-300 bg-amber-50/60 text-amber-950 hover:bg-amber-100 text-xs h-9 font-semibold gap-1.5"
            >
              <Share2 size={14} className="text-amber-700" />
              Notifier Client
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl border-[#dfe8e4] bg-white text-[#35544c] hover:bg-[#edf5f1] text-xs h-9"
            >
              <Printer size={15} className="mr-1.5" /> Imprimer / PDF
            </Button>

            <div className="flex items-center rounded-xl border border-[#dfe8e4] bg-white p-0.5">
              <Button
                variant="ghost"
                size="icon"
                disabled={!prev}
                onClick={() => prev && setLocation(`/dossiers/${prev.id}`)}
                className="h-8 w-8 rounded-lg"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!next}
                onClick={() => next && setLocation(`/dossiers/${next.id}`)}
                className="h-8 w-8 rounded-lg"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation par Onglets avec Filtrage RBAC Strict */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white/80 p-1 border border-[#dfe8e4] rounded-2xl shadow-sm h-11">
          <TabsTrigger value="general" className="rounded-xl text-xs data-[state=active]:bg-[#0b3b32] data-[state=active]:text-white">
            <FileText size={14} className="mr-1.5" /> Fiche Opérationnelle
          </TabsTrigger>
          {!isNew && (
            <>
              <TabsTrigger value="customs" className="rounded-xl text-xs data-[state=active]:bg-[#0b3b32] data-[state=active]:text-white">
                <ShieldCheck size={14} className="mr-1.5" /> Suivi Douane & PAC
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-xl text-xs data-[state=active]:bg-[#0b3b32] data-[state=active]:text-white">
                <Paperclip size={14} className="mr-1.5" /> Documents & Preuves ({docsQuery.data?.length || 0})
              </TabsTrigger>
              {/* Onglet Facturation & Marges MASQUÉ si !canViewFinances (Déclarant & Client) */}
              {perms.canViewFinances && (
                <TabsTrigger value="finances" className="rounded-xl text-xs data-[state=active]:bg-[#0b3b32] data-[state=active]:text-white">
                  <CircleDollarSign size={14} className="mr-1.5" /> Facturation & Marges
                </TabsTrigger>
              )}
              <TabsTrigger value="tasks" className="rounded-xl text-xs data-[state=active]:bg-[#0b3b32] data-[state=active]:text-white">
                <ListTodo size={14} className="mr-1.5" /> Tâches & Suivi ({tasksQuery.data?.length || 0})
              </TabsTrigger>
              {perms.canViewAudit && (
                <TabsTrigger value="audit" className="rounded-xl text-xs data-[state=active]:bg-[#0b3b32] data-[state=active]:text-white">
                  <History size={14} className="mr-1.5" /> Audit & Historique
                </TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        {/* ONGLET 1: Fiche générale */}
        <TabsContent value="general">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section Fret & Port */}
            <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f1ed] text-[#1d7764]">
                      <FileCheck2 size={18} />
                    </div>
                    <div>
                      <h2 className="font-[Georgia] text-xl font-semibold text-[#173b32]">
                        {form.transportMode === "Aérien" ? "Fret Aérien & Marchandises" : form.transportMode === "Routier" ? "Transit Routier Inter-États & Fret" : "Transit Maritime & Marchandises"}
                      </h2>
                      <p className="text-xs text-[#81918b]">Données d’identification du fret et titres de transport douaniers.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs border-emerald-800 text-emerald-950 font-semibold">
                    Transport : {form.transportMode || "Maritime"}
                  </Badge>
                </div>

                <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                  <ReferenceSelect label="Mode de transport *" field="transportMode" category="mode_transport" form={form} setForm={setForm} references={references} required invalid={showValidation && !form.transportMode} errorMessage="Mode de transport obligatoire" />
                  <Field label="N° dossier client *" field="clientDossierNumber" form={form} setForm={setForm} required invalid={showValidation && !form.clientDossierNumber} errorMessage="N° dossier client requis (ex: CKYSI26000340)" placeholder="ex: CKYSI26000340" />
                  <ReferenceSelectOrInput label="Client / Destinataire *" field="client" category="client" form={form} setForm={setForm} references={references} required invalid={showValidation && !form.client} errorMessage="Client / destinataire obligatoire" placeholder="ex: Guinean Birimian Gold" />
                  
                  <Field
                    label={form.transportMode === "Aérien" ? "N° LTA (Lettre de Transport Aérien) *" : form.transportMode === "Routier" ? "N° Lettre de voiture (CMR / TRIE) *" : "N° BL (Connaissement maritime) *"}
                    field="blLtaNumber"
                    form={form}
                    setForm={setForm}
                    required
                    invalid={showValidation && !form.blLtaNumber}
                    errorMessage={form.transportMode === "Aérien" ? "N° LTA requis (ex: AF-057-98765432)" : form.transportMode === "Routier" ? "N° CMR requis (ex: CMR-GN-2026)" : "N° BL Connaissement requis"}
                    placeholder={form.transportMode === "Aérien" ? "ex: AF-057-98765432" : form.transportMode === "Routier" ? "ex: CMR-GN-2026-4401" : "ex: HLCUNG12604AUQG1"}
                  />
                  <Field label="Nature de marchandise *" field="cargoNature" form={form} setForm={setForm} required invalid={showValidation && !form.cargoNature} errorMessage="Précisez la nature de la marchandise" placeholder="ex: Cyanure, Tubes d'acier, Équipement minier" />
                  <Field label="Date ETA / Arrivée prévue *" field="eta" form={form} setForm={setForm} required type="date" invalid={showValidation && !form.eta} errorMessage="Date ETA d'arrivée requise" />

                  <ReferenceSelectOrInput
                    label={form.transportMode === "Aérien" ? "Aéroport d’origine *" : form.transportMode === "Routier" ? "Poste frontière de départ *" : "Port d’origine (POL) *"}
                    field="originPort"
                    category="port_origine"
                    form={form}
                    setForm={setForm}
                    references={references}
                    required
                    invalid={showValidation && !form.originPort}
                    errorMessage="Origine de transport requise"
                    placeholder={form.transportMode === "Aérien" ? "ex: Paris CDG, Istanbul IST" : form.transportMode === "Routier" ? "ex: Bamako, Dakar" : "ex: Ningbo-China, Anvers"}
                  />
                  <ReferenceSelectOrInput
                    label={form.transportMode === "Aérien" ? "Aéroport de destination *" : form.transportMode === "Routier" ? "Poste frontière d'entrée *" : "Port de destination (POD) *"}
                    field="destinationPort"
                    category="port_destination"
                    form={form}
                    setForm={setForm}
                    references={references}
                    required
                    invalid={showValidation && !form.destinationPort}
                    errorMessage="Destination requise"
                    placeholder={form.transportMode === "Aérien" ? "ex: Conakry Gbessia CKY" : form.transportMode === "Routier" ? "ex: Kourémalé, Pamelap" : "ex: Port Autonome de Conakry"}
                  />

                  {form.transportMode !== "Aérien" && (
                    <Field
                      label="Conteneur(s) (TC)"
                      field="container"
                      form={form}
                      setForm={setForm}
                      placeholder="ex: 04TC20', 02TC40'"
                      invalid={showValidation && (form.transportMode || "Maritime") === "Maritime" && !form.container && !form.bulk}
                      errorMessage="Indiquez au moins les conteneurs ou le volume vrac"
                    />
                  )}

                  <Field
                    label={form.transportMode === "Aérien" ? "Colis / Poids brut (PKG / Kg)" : form.transportMode === "Routier" ? "Tonnage / Immatriculation camions" : "Vrac / Colis (PKG)"}
                    field="bulk"
                    form={form}
                    setForm={setForm}
                    placeholder={form.transportMode === "Aérien" ? "ex: 12 Colis, 450 Kg" : form.transportMode === "Routier" ? "ex: 35 Tonnes, RC-1234-A" : "ex: 56 PKG, 120 Tonnes"}
                    invalid={showValidation && (form.transportMode || "Maritime") === "Maritime" && !form.container && !form.bulk}
                    errorMessage="Indiquez au moins les conteneurs ou le volume vrac"
                  />

                  <Field label="Date sortie marchandises (PAC / Entrepôt)" field="goodsReleaseDate" form={form} setForm={setForm} type="date" placeholder="Laisser vide si marchandise encore au quai" />
                  <Field label="N° déclaration douane (Sydonia)" field="declarationNumber" form={form} setForm={setForm} placeholder="ex: S 142- 27/07/2026" />
                  <Field label="N° bulletin de liquidation (BLD)" field="bulletinNumber" form={form} setForm={setForm} placeholder="ex: L 1774 Du 28/07/2026" />
                  <Field label="N° déclaration définitive" field="finalDeclarationNumber" form={form} setForm={setForm} placeholder="ex: C 1398-2026" />
                </div>
              </CardContent>
            </Card>

            {/* Section Procédures Douanières */}
            <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-[Georgia] text-xl font-semibold text-[#173b32] mb-4">Procédures Douane Guinée, PAC & Suivi</h2>
                <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                  <ReferenceSelect label="Statut douane" field="customsStatus" category="statut_douane" form={form} setForm={setForm} references={references} />
                  <ReferenceSelect label="Statut portuaire (PAC)" field="portStatus" category="statut_port" form={form} setForm={setForm} references={references} />
                  <ReferenceSelect label="Statut financier" field="financialStatus" category="statut_financier" form={form} setForm={setForm} references={references} />
                  <ReferenceSelect label="Régime douanier" field="regime" category="regime" form={form} setForm={setForm} references={references} />
                  <ReferenceSelectOrInput label="Responsable dossier" field="responsible" category="responsable" form={form} setForm={setForm} references={references} placeholder="ex: Mamadou Diallo" />
                  <ReferenceSelectOrInput label="Déclarant" field="declarant" category="declarant" form={form} setForm={setForm} references={references} placeholder="ex: Alpha Barry" />
                  <Field label="Lieu de livraison" field="deliveryLocation" form={form} setForm={setForm} placeholder="ex: Entrepôt IGS Kagbelen" />
                  <Field label="Opération terrain" field="fieldOperation" form={form} setForm={setForm} placeholder="ex: Visite de douane quai 3" />
                  <Field label="Alerte terrain" field="fieldAlert" form={form} setForm={setForm} placeholder="ex: Surestaries imminentes" />
                  <div className="md:col-span-2 lg:col-span-3">
                    <Label htmlFor="notes" className="text-xs font-semibold text-[#516760]">Notes internes & observations</Label>
                    <Textarea id="notes" value={form.notes || ""} onChange={e => setForm(c => ({ ...c, notes: e.target.value }))} className="mt-1 min-h-[80px] rounded-xl border-[#dfe9e4]" placeholder="Historique et instructions spécifiques..." />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Boutons d'action : Brouillon vs Validation Complète */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              {!isNew && perms.canDeleteDossier && (
                <Button type="button" variant="ghost" onClick={() => removeMutation.mutate({ id: numericId })} className="text-rose-600 hover:bg-rose-50 rounded-xl text-xs">
                  <Trash2 size={16} className="mr-1.5" /> Supprimer ce dossier
                </Button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2.5">
                <Button type="button" variant="outline" onClick={() => setLocation("/dossiers")} className="rounded-xl border-[#dfe8e4] text-xs">
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl border-emerald-800 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold"
                >
                  <Bookmark size={15} className="mr-1.5 text-emerald-700" />
                  Sauvegarder en brouillon
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] px-5 text-xs font-semibold shadow-sm"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={15} className="mr-2 animate-spin" />}
                  <Save size={15} className="mr-2" /> {isNew ? "Valider & Créer le dossier" : "Enregistrer les modifications"}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ONGLET 2: Suivi Douane & Port PAC */}
        {!isNew && dossier && (
          <TabsContent value="customs" className="space-y-4">
            <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-[Georgia] text-xl font-semibold text-[#173b32]">Suivi Opérationnel Douane & Port Autonome de Conakry</h2>
                    <p className="text-xs text-muted-foreground">Mise à jour en temps réel des documents clés SYDONIA, GUCEG et statut PAC.</p>
                  </div>
                  {perms.canEditCustoms && (
                    <Button onClick={() => setCustomsModalOpen(true)} className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs">
                      <Edit3 size={14} className="mr-1.5" /> Modifier les identifiants
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-xs font-semibold text-emerald-800">DDI GUCEG</span>
                    <p className="text-sm font-bold text-emerald-950 mt-1 font-mono">{dossier.ddiGucegNumber || "Non renseigné"}</p>
                    <div className="mt-3 flex gap-2">
                      <Badge className={dossier.ddiGucegNumber ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {dossier.ddiGucegNumber ? "Déposée" : "En attente"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-xs font-semibold text-emerald-800">Déclaration Sydonia</span>
                    <p className="text-sm font-bold text-emerald-950 mt-1 font-mono">{dossier.declarationNumber || "Non renseigné"}</p>
                    <div className="mt-3 flex gap-2">
                      <Badge className={dossier.declarationNumber ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {dossier.declarationNumber ? "Validée" : "Manquante"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-xs font-semibold text-emerald-800">Bulletin de Liquidation (BLD)</span>
                    <p className="text-sm font-bold text-emerald-950 mt-1 font-mono">{dossier.bulletinNumber || "Non renseigné"}</p>
                    <div className="mt-3 flex gap-2">
                      <Badge className={dossier.bulletinNumber ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {dossier.bulletinNumber ? "Émis" : "En attente"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <span className="text-xs font-semibold text-emerald-800">Bon à Enlever (BAE) & BAD</span>
                    <p className="text-sm font-bold text-emerald-950 mt-1">BAE : {dossier.baeStatus || "En attente"} • BAD : {dossier.badStatus || "En attente"}</p>
                    <div className="mt-3 flex gap-2">
                      <Badge className={dossier.baeStatus === "Accordé" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {dossier.baeStatus || "En attente"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Bascule Rapide de Statut Terrain */}
                {perms.canEditCustoms && (
                  <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/70 space-y-3">
                    <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Actions Rapides Déclarant PAC</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCustomsQuickMutation.mutate({ id: numericId, data: { badStatus: "Obtenu" } })}
                        className="rounded-xl border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs"
                      >
                        <Check size={13} className="mr-1 text-emerald-700" /> Marquer BAD Obtenu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCustomsQuickMutation.mutate({ id: numericId, data: { baeStatus: "Accordé" } })}
                        className="rounded-xl border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs"
                      >
                        <Check size={13} className="mr-1 text-emerald-700" /> Marquer BAE Accordé
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCustomsQuickMutation.mutate({ id: numericId, data: { customsStatus: "Déclaration Validée" } })}
                        className="rounded-xl border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs"
                      >
                        <Check size={13} className="mr-1 text-emerald-700" /> Valider Déclaration Douane
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ONGLET 2: Documents & Preuves */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[Georgia] text-lg font-semibold text-[#173b32]">Gestion Documentaire & Preuves de Conformité</h2>
              <p className="text-xs text-muted-foreground">Téléversez les originaux scannés (BL, Déclaration Sydonia, Bulletin DDI, Factures, BAE, Photos).</p>
            </div>
            
            <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs">
                  <UploadCloud size={14} className="mr-1.5" /> Ajouter une pièce jointe
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Téléverser un document de preuve</DialogTitle>
                  <DialogDescription>Associez un document scanné ou une photo de marchandise à ce dossier.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type de document</Label>
                    <select
                      value={newDocType}
                      onChange={e => setNewDocType(e.target.value as any)}
                      className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                    >
                      <option value="BL">Connaissement Maritime (BL)</option>
                      <option value="Declaration_Douane">Déclaration Sydonia World</option>
                      <option value="Bulletin_Liquidation">Bulletin de Liquidation (BLD)</option>
                      <option value="DDI">DDI (GUCEG Guinée)</option>
                      <option value="BAE">Bon à Enlever (BAE)</option>
                      <option value="Facture_Fournisseur">Facture Commerciale</option>
                      <option value="Facture_Transitaire">Facture Transit / Débours</option>
                      <option value="Photos_Marchandise">Photos de marchandise / Quai</option>
                      <option value="Autre">Autre document</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fichier (PDF, Image)</Label>
                    <Input type="file" onChange={handleFileUploadMock} className="rounded-xl" />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docsQuery.data?.length === 0 ? (
              <Card className="col-span-full border-dashed p-8 text-center bg-white/60">
                <Paperclip className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">Aucun document joint pour ce dossier.</p>
                <p className="text-xs text-muted-foreground">Téléversez le BL scanné ou la déclaration de douane pour prouver la régularisation.</p>
              </Card>
            ) : (
              docsQuery.data?.map(doc => (
                <Card key={doc.id} className="border border-emerald-900/10 bg-white shadow-sm hover:shadow transition">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-800 text-emerald-900">
                          {doc.type.replace("_", " ")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <h3 className="mt-2 font-semibold text-xs text-emerald-950 truncate" title={doc.name}>
                        {doc.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Ajouté par : {doc.uploaderName || "Opérateur IGS"}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t pt-2.5">
                      <a
                        href={doc.fileUrl}
                        download={doc.name}
                        className="inline-flex items-center text-xs font-semibold text-emerald-800 hover:text-emerald-950"
                      >
                        <Download size={13} className="mr-1" /> Télécharger
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDocMutation.mutate({ id: doc.id })}
                        className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ONGLET 3: Facturation & Finances (Gated via perms.canViewFinances) */}
        {perms.canViewFinances && (
          <TabsContent value="finances" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-[Georgia] text-lg font-semibold text-[#173b32]">Facturation, Débours & Marge Opérationnelle</h2>
                <p className="text-xs text-muted-foreground">Générez des factures en Francs Guinéens (GNF) ou USD avec suivi des surestaries PAC.</p>
              </div>

              {perms.canManageInvoices && (
                <Dialog open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs">
                      <Plus size={14} className="mr-1.5" /> Émettre une Facture
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Créer une facture de transit</DialogTitle>
                      <DialogDescription>Générez la facture pour le client {dossier?.client}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Devise</Label>
                          <select value={invoiceCurrency} onChange={e => setInvoiceCurrency(e.target.value)} className="h-9 w-full rounded-xl border px-2 text-xs">
                            <option value="GNF">GNF (Franc Guinéen)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Montant HT</Label>
                          <Input type="number" value={invoiceAmountHt} onChange={e => setInvoiceAmountHt(Number(e.target.value))} className="h-9 text-xs" />
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50/70 p-3 text-xs space-y-1 text-emerald-950">
                        <div className="flex justify-between"><span>TVA (18%) :</span><strong>{(invoiceAmountHt * 0.18).toLocaleString()} {invoiceCurrency}</strong></div>
                        <div className="flex justify-between border-t pt-1 font-bold"><span>Total TTC :</span><strong>{(invoiceAmountHt * 1.18).toLocaleString()} {invoiceCurrency}</strong></div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => createInvoiceMutation.mutate({
                        dossierId: numericId,
                        client: dossier?.client || "Client",
                        currency: invoiceCurrency,
                        amountHt: invoiceAmountHt,
                        amountTva: invoiceAmountHt * 0.18,
                        amountTtc: invoiceAmountHt * 1.18,
                        status: "Émise",
                      })} className="rounded-xl bg-[#0b3b32] text-white">Confirmer l'émission</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid gap-3">
              {invoicesQuery.data?.length === 0 ? (
                <Card className="p-8 text-center border-dashed bg-white/60">
                  <Coins className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-medium text-muted-foreground">Aucune facture enregistrée pour ce dossier.</p>
                  {perms.canManageInvoices && (
                    <Button size="sm" onClick={() => setCreateInvoiceOpen(true)} className="mt-3 rounded-xl bg-[#0b3b32] text-white text-xs">
                      Générer une facture proforma / finale
                    </Button>
                  )}
                </Card>
              ) : (
                invoicesQuery.data?.map(inv => (
                  <Card key={inv.id} className="border border-emerald-950/10 bg-white p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#102c26]">{inv.invoiceNumber}</span>
                          <Badge className={inv.status === "Payée" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                            {inv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Émise le {new Date(inv.createdAt).toLocaleDateString("fr-FR")} • Échéance : {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("fr-FR") : "30j"}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-lg font-bold text-[#102c26]">{inv.amountTtc.toLocaleString()} {inv.currency}</span>
                          {perms.canViewMargin && (
                            <p className="text-[11px] text-emerald-700 font-semibold">Marge estimée : +{inv.estimatedMargin.toLocaleString()} {inv.currency}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              toast.info("Téléchargement de la facture PDF...");
                              const { generateInvoicePdf } = await import("@/lib/pdfGenerator");
                              await generateInvoicePdf({
                                invoiceNumber: inv.invoiceNumber,
                                type: inv.invoiceType || "Definitive",
                                status: inv.status,
                                dossierNumber: dossier?.dossierNumber || `DOS-${numericId}`,
                                client: dossier?.client || inv.client,
                                blLtaNumber: dossier?.blLtaNumber,
                                cargoNature: dossier?.cargoNature,
                                container: dossier?.container,
                                bulk: dossier?.bulk,
                                amountTtc: inv.amountTtc,
                                currency: inv.currency,
                                estimatedMargin: inv.estimatedMargin,
                                createdAt: inv.createdAt,
                                dueDate: inv.dueDate,
                                portalAccessCode: dossier?.portalAccessCode,
                              });
                              toast.success(`Facture ${inv.invoiceNumber} téléchargée.`);
                            } catch (e) {
                              toast.error("Erreur lors de la génération du PDF");
                            }
                          }}
                          className="h-8 rounded-xl border-emerald-800/40 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold gap-1.5"
                        >
                          <FileText size={13} className="text-emerald-700" /> Télécharger PDF
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        {/* ONGLET 4: Tâches & Collaboration */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[Georgia] text-lg font-semibold text-[#173b32]">Tâches Opérationnelles & Collaboration</h2>
              <p className="text-xs text-muted-foreground">Check-list des étapes clés (visite douane, paiement PAC, bon à enlever, livraison).</p>
            </div>

            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs">
                  <Plus size={14} className="mr-1.5" /> Assigner une tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nouvelle tâche opérationnelle</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Intitulé de la tâche</Label>
                    <Input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="ex: Récupérer le bon de sortie PAC quai conteneur" className="rounded-xl text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Assigné à</Label>
                    <Input value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="rounded-xl text-xs" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createTaskMutation.mutate({ dossierId: numericId, title: newTaskTitle, assignedTo: newTaskAssignee })} className="rounded-xl bg-[#0b3b32] text-white">
                    Créer la tâche
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-2">
            {tasksQuery.data?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucune tâche assignée pour ce dossier.</p>
            ) : (
              tasksQuery.data?.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateTaskMutation.mutate({ id: task.id, status: task.status === "Termine" ? "A_faire" : "Termine" })}
                      className={`h-5 w-5 rounded-md border flex items-center justify-center transition ${task.status === "Termine" ? "bg-emerald-700 border-emerald-700 text-white" : "border-gray-300"}`}
                    >
                      {task.status === "Termine" && <Check size={12} />}
                    </button>
                    <div>
                      <p className={`text-xs font-semibold ${task.status === "Termine" ? "line-through text-muted-foreground" : "text-emerald-950"}`}>
                        {task.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Assigné à {task.assignedTo || "Équipe"} • Échéance : {task.dueDate ? new Date(task.dueDate).toLocaleDateString("fr-FR") : "Immédiat"}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{task.status.replace("_", " ")}</Badge>
                </div>
              ))
            )}
          </div>

          {/* Fil de discussion et commentaires */}
          <div className="mt-6 border-t pt-4 space-y-3">
            <h3 className="font-[Georgia] text-sm font-semibold text-[#173b32]">Notes & Commentaires d'équipe</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {commentsQuery.data?.map(c => (
                <div key={c.id} className="p-2.5 rounded-xl bg-gray-50 text-xs border border-gray-100">
                  <div className="flex justify-between font-semibold text-emerald-950">
                    <span>{c.authorName}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">{new Date(c.createdAt).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ajouter une instruction ou remarque..." className="rounded-xl text-xs" />
              <Button size="sm" onClick={() => newComment.trim() && addCommentMutation.mutate({ dossierId: numericId, message: newComment.trim() })} className="rounded-xl bg-[#0b3b32] text-white">
                Envoyer
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ONGLET 5: Audit Trail & Historique (Gated via perms.canViewAudit) */}
        {perms.canViewAudit && (
          <TabsContent value="audit" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
              <div>
                <h2 className="font-[Georgia] text-lg font-semibold text-[#173b32] flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  Journal d'Audit & Traçabilité Réglementaire
                </h2>
                <p className="text-xs text-muted-foreground">
                  Registre immuable des transitions douanières (SYDONIA, BLD, BAE, PAC), opérations financières et documents (preuve légale et conformité).
                </p>
              </div>

              {/* Filtres de catégorie d'audit */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Tout l'historique" },
                  { id: "customs", label: "Douane & PAC" },
                  { id: "finance", label: "Finances & Factures" },
                  { id: "documents", label: "Pièces & Documents" },
                ].map(tab => (
                  <Button
                    key={tab.id}
                    type="button"
                    variant={auditFilter === tab.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAuditFilter(tab.id as any)}
                    className={
                      auditFilter === tab.id
                        ? "bg-[#0b3b32] text-white text-[11px] h-7 rounded-lg"
                        : "text-gray-600 text-[11px] h-7 rounded-lg border-gray-200"
                    }
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Statistiques d'audit */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Total Événements</span>
                <p className="text-lg font-bold text-emerald-950">{auditQuery.data?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <span className="text-[10px] uppercase font-bold text-blue-700">Contrôles Douane</span>
                <p className="text-lg font-bold text-blue-950">
                  {auditQuery.data?.filter(e => e.action?.includes("DOUANE") || e.action?.includes("SYDONIA") || e.action?.includes("BLD") || e.action?.includes("BAE") || e.action?.includes("BAD") || e.action?.includes("PAC") || e.action?.includes("DDI")).length || 0}
                </p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <span className="text-[10px] uppercase font-bold text-amber-700">Opérations Financières</span>
                <p className="text-lg font-bold text-amber-950">
                  {auditQuery.data?.filter(e => e.action?.includes("FACTURE") || e.action?.includes("PAIEMENT") || e.action?.includes("DEBOURS") || e.entityType === "invoice" || e.entityType === "payment" || e.entityType === "disbursement").length || 0}
                </p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
                <span className="text-[10px] uppercase font-bold text-purple-700">Documents Liés</span>
                <p className="text-lg font-bold text-purple-950">
                  {auditQuery.data?.filter(e => e.entityType === "document" || e.action?.includes("DOCUMENT")).length || 0}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative pl-6 border-l-2 border-emerald-900/20 space-y-4 py-2">
              {auditQuery.data
                ?.filter(entry => {
                  if (auditFilter === "all") return true;
                  if (auditFilter === "customs") {
                    return (
                      entry.action?.includes("DOUANE") ||
                      entry.action?.includes("SYDONIA") ||
                      entry.action?.includes("BLD") ||
                      entry.action?.includes("BAE") ||
                      entry.action?.includes("BAD") ||
                      entry.action?.includes("PAC") ||
                      entry.action?.includes("DDI") ||
                      entry.fieldChanged === "declarationNumber" ||
                      entry.fieldChanged === "bulletinNumber" ||
                      entry.fieldChanged === "baeStatus" ||
                      entry.fieldChanged === "badStatus"
                    );
                  }
                  if (auditFilter === "finance") {
                    return (
                      entry.action?.includes("FACTURE") ||
                      entry.action?.includes("PAIEMENT") ||
                      entry.action?.includes("DEBOURS") ||
                      entry.entityType === "invoice" ||
                      entry.entityType === "payment" ||
                      entry.entityType === "disbursement" ||
                      entry.fieldChanged === "financialStatus" ||
                      entry.fieldChanged === "Facture" ||
                      entry.fieldChanged === "Paiement Facture" ||
                      entry.fieldChanged === "Débours PAC"
                    );
                  }
                  if (auditFilter === "documents") {
                    return entry.entityType === "document" || entry.action?.includes("DOCUMENT") || entry.fieldChanged === "Document";
                  }
                  return true;
                })
                .map(entry => {
                  const isCustoms =
                    entry.action?.includes("DOUANE") ||
                    entry.action?.includes("SYDONIA") ||
                    entry.action?.includes("BLD") ||
                    entry.action?.includes("BAE") ||
                    entry.action?.includes("BAD") ||
                    entry.action?.includes("PAC") ||
                    entry.action?.includes("DDI");
                  const isFinance =
                    entry.action?.includes("FACTURE") ||
                    entry.action?.includes("PAIEMENT") ||
                    entry.action?.includes("DEBOURS") ||
                    entry.entityType === "invoice" ||
                    entry.entityType === "payment" ||
                    entry.entityType === "disbursement";
                  const isDoc = entry.entityType === "document" || entry.action?.includes("DOCUMENT");

                  const dotColor = isCustoms ? "bg-blue-600" : isFinance ? "bg-amber-600" : isDoc ? "bg-purple-600" : "bg-emerald-700";
                  const badgeBg = isCustoms
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : isFinance
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : isDoc
                    ? "bg-purple-50 text-purple-800 border-purple-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200";

                  return (
                    <div key={entry.id} className="relative group">
                      <span className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full ${dotColor} ring-4 ring-white shadow-xs`} />
                      <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs hover:border-gray-300 transition text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeBg}`}>
                              {entry.action ? entry.action.replace(/_/g, " ") : entry.fieldChanged}
                            </span>
                            <span className="font-bold text-gray-900">{entry.fieldChanged}</span>
                            {entry.userRole && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-gray-500 font-mono">
                                {entry.userRole.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(entry.createdAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-700 bg-gray-50/70 p-2 rounded-xl border border-gray-100">
                          <strong className="text-gray-900 font-semibold">{entry.authorName || "Système IGS"}</strong>
                          <span>:</span>
                          {entry.previousValue && (
                            <span className="text-muted-foreground line-through font-mono">
                              {entry.previousValue}
                            </span>
                          )}
                          {entry.previousValue && <span className="text-gray-400">➔</span>}
                          <span className="font-mono font-semibold text-emerald-900">
                            {entry.newValue}
                          </span>
                        </div>

                        {entry.comment && (
                          <p className="text-[11px] text-muted-foreground italic pl-1">
                            « {entry.comment} »
                          </p>
                        )}

                        {entry.ipAddress && (
                          <div className="text-[9px] text-gray-400 font-mono">
                            IP Enregistrée : {entry.ipAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Customs Fast Edit Modal */}
      {dossier && (
        <CustomsEditModal
          isOpen={customsModalOpen}
          onClose={() => setCustomsModalOpen(false)}
          dossier={dossier}
          onSuccess={() => utils.dossier.get.invalidate({ id: rawId! })}
        />
      )}

      {/* Modale de Résolution de Conflits d'Édition Simultanée (R2) */}
      <ConflictResolutionModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        dossierNumber={dossier?.dossierNumber || form.clientDossierNumber || "DOS-XXXX"}
        serverVersion={dossier?.version}
        serverUpdatedAt={dossier?.updatedAt}
        diffs={conflictDiffs}
        onReload={handleReloadServerData}
        onForceOverwrite={handleForceOverwrite}
        isOverwriting={updateMutation.isPending}
      />

      {/* Modal d'envoi d'Alerte Multi-Canal (WhatsApp / Email) */}
      <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-[Georgia] text-xl text-[#102c26]">
              Notifier le Client / Déclarant
            </DialogTitle>
            <DialogDescription className="text-xs text-[#627670]">
              Transmettez une alerte d'étape en direct par WhatsApp ou Email professionnel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3a504a]">Canal de diffusion</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={alertChannel === "whatsapp" ? "default" : "outline"}
                  onClick={() => setAlertChannel("whatsapp")}
                  className={alertChannel === "whatsapp" ? "bg-emerald-700 text-white text-xs h-9" : "text-xs h-9"}
                >
                  🟢 WhatsApp
                </Button>
                <Button
                  type="button"
                  variant={alertChannel === "email" ? "default" : "outline"}
                  onClick={() => setAlertChannel("email")}
                  className={alertChannel === "email" ? "bg-emerald-700 text-white text-xs h-9" : "text-xs h-9"}
                >
                  ✉️ Email Pro
                </Button>
              </div>
            </div>

            {alertChannel === "whatsapp" ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#3a504a]">Numéro WhatsApp Destinataire</Label>
                <Input
                  value={alertPhone}
                  onChange={e => setAlertPhone(e.target.value)}
                  placeholder="+224 620 00 00 00"
                  className="rounded-xl text-xs font-mono"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#3a504a]">Adresse Email Destinataire</Label>
                <Input
                  type="email"
                  value={alertEmail}
                  onChange={e => setAlertEmail(e.target.value)}
                  placeholder="direction@client.gn"
                  className="rounded-xl text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3a504a]">Message d'alerte opérationnelle</Label>
              <Textarea
                rows={4}
                value={alertMessage}
                onChange={e => setAlertMessage(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAlertModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Annuler
            </Button>
            <Button
              disabled={sendWhatsAppMutation.isPending || sendEmailMutation.isPending}
              onClick={() => {
                if (!dossier) return;
                if (alertChannel === "whatsapp") {
                  sendWhatsAppMutation.mutate({
                    dossierNumber: dossier.dossierNumber,
                    recipientPhone: alertPhone,
                    clientName: dossier.client || "Client IGS",
                    messageText: alertMessage,
                  });
                } else {
                  sendEmailMutation.mutate({
                    dossierNumber: dossier.dossierNumber,
                    recipientEmail: alertEmail,
                    clientName: dossier.client || "Client IGS",
                    subject: `[IGS Transit] Mise à jour du dossier ${dossier.dossierNumber}`,
                    htmlContent: `<p>${alertMessage}</p><p><a href="https://igs-suivis-de-dossier-saas.vercel.app/portail-client">Accéder au portail client</a></p>`,
                  });
                }
              }}
              className="rounded-xl bg-[#0b3b32] text-white text-xs h-9"
            >
              {(sendWhatsAppMutation.isPending || sendEmailMutation.isPending) && (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              )}
              Diffuser l'alerte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DossierDetailPage() {
  return (
    <DashboardLayout>
      <DetailContent />
    </DashboardLayout>
  );
}
