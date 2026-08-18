import DashboardLayout from "@/components/DashboardLayout";
import { CustomsEditModal } from "@/components/CustomsEditModal";
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
  Save,
  Share2,
  ShieldAlert,
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
  type = "text",
  invalid = false,
  placeholder,
  disabled = false,
}: {
  label: string;
  field: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  required?: boolean;
  type?: string;
  invalid?: boolean;
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
          invalid ? "border-[#cf5c46]" : "border-[#dfe9e4]"
        } ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
      />
      {invalid && (
        <p id={`${field}-error`} role="alert" className="text-[11px] font-medium text-[#ba4a36]">
          Ce champ est requis.
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
            invalid ? "border-[#cf5c46]" : "border-[#dfe9e4]"
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
          Ce champ est requis.
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
          invalid ? "border-[#cf5c46]" : "border-[#dfe9e4]"
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
          Ce champ est requis.
        </p>
      )}
    </div>
  );
}

function DetailContent() {
  const [, params] = useRoute("/dossiers/:id");
  const [location, setLocation] = useLocation();
  const isNew = location === "/dossiers/nouveau";
  const id = Number(params?.id);
  const perms = usePermissions();

  const { data: dossier, isLoading } = trpc.dossier.get.useQuery(
    { id },
    { enabled: !isNew && Number.isFinite(id) }
  );
  const { data: references = [] } = trpc.reference.list.useQuery();
  const { data: dossiers = [] } = trpc.dossier.list.useQuery();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(blank);
  const [showValidation, setShowValidation] = useState(false);
  const [customsModalOpen, setCustomsModalOpen] = useState(false);

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

  // Requêtes additionnelles pour les onglets
  const docsQuery = trpc.document.list.useQuery({ dossierId: id }, { enabled: !isNew && Boolean(id) });
  const auditQuery = trpc.audit.list.useQuery({ dossierId: id }, { enabled: !isNew && Boolean(id) && perms.canViewAudit });
  const invoicesQuery = trpc.finance.listInvoices.useQuery({ dossierId: id }, { enabled: !isNew && Boolean(id) && perms.canViewFinances });
  const tasksQuery = trpc.task.list.useQuery({ dossierId: id }, { enabled: !isNew && Boolean(id) });
  const commentsQuery = trpc.comment.list.useQuery({ dossierId: id }, { enabled: !isNew && Boolean(id) });

  // Mutations
  const uploadDocMutation = trpc.document.upload.useMutation({
    onSuccess: () => {
      toast.success("Document téléversé avec succès");
      setUploadDocOpen(false);
      docsQuery.refetch();
      auditQuery.refetch();
    },
  });

  const deleteDocMutation = trpc.document.remove.useMutation({
    onSuccess: () => {
      toast.success("Document supprimé");
      docsQuery.refetch();
    },
  });

  const createInvoiceMutation = trpc.finance.createInvoice.useMutation({
    onSuccess: () => {
      toast.success("Facture générée avec succès");
      setCreateInvoiceOpen(false);
      invoicesQuery.refetch();
      utils.dossier.get.invalidate({ id });
    },
  });

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Tâche ajoutée à la check-list");
      setCreateTaskOpen(false);
      setNewTaskTitle("");
      tasksQuery.refetch();
    },
  });

  const updateTaskMutation = trpc.task.updateStatus.useMutation({
    onSuccess: () => tasksQuery.refetch(),
  });

  const addCommentMutation = trpc.comment.add.useMutation({
    onSuccess: () => {
      setNewComment("");
      commentsQuery.refetch();
    },
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

  const sortedDossiers = useMemo(
    () => [...dossiers].sort((a, b) => a.dossierNumber.localeCompare(b.dossierNumber)),
    [dossiers]
  );
  const currentIndex = sortedDossiers.findIndex(item => item.id === id);
  const prev = currentIndex > 0 ? sortedDossiers[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < sortedDossiers.length - 1 ? sortedDossiers[currentIndex + 1] : null;

  const createMutation = trpc.dossier.create.useMutation({
    onSuccess: created => {
      toast.success(`Dossier ${created.dossierNumber} créé avec succès`);
      utils.dossier.invalidate();
      utils.dashboard.invalidate();
      setLocation(`/dossiers/${created.id}`);
    },
    onError: err => toast.error(err.message || "Erreur de création"),
  });

  const updateMutation = trpc.dossier.update.useMutation({
    onSuccess: updated => {
      toast.success(`Dossier ${updated?.dossierNumber} mis à jour`);
      utils.dossier.invalidate();
      utils.dashboard.invalidate();
      auditQuery.refetch();
    },
    onError: err => toast.error(err.message || "Erreur de mise à jour"),
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setShowValidation(true);
    const requiredKeys = ["clientDossierNumber", "client", "blLtaNumber", "cargoNature", "transportMode", "eta", "originPort", "destinationPort", "goodsReleaseDate", "declarationNumber", "bulletinNumber"];
    const isMissingRequired = requiredKeys.some(key => !form[key]);
    const hasPackaging = Boolean(form.container || form.bulk);

    if (isMissingRequired || !hasPackaging) {
      toast.error("Veuillez renseigner tous les champs obligatoires (*) marqués en rouge.");
      return;
    }

    const payload = {
      clientDossierNumber: toText(form.clientDossierNumber),
      client: toText(form.client),
      blLtaNumber: toText(form.blLtaNumber),
      cargoNature: toText(form.cargoNature),
      transportMode: toText(form.transportMode),
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
    };

    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id, data: payload });
    }
  };

  const handleFileUploadMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadDocMutation.mutate({
        dossierId: id,
        name: file.name,
        type: newDocType,
        fileUrl: String(reader.result),
        fileSize: file.size,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
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

        {!isNew && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Action Rapide Douane pour Déclarant & Admin */}
            {perms.canEditCustoms && dossier && (
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
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f1ed] text-[#1d7764]">
                    <FileCheck2 size={18} />
                  </div>
                  <div>
                    <h2 className="font-[Georgia] text-xl font-semibold text-[#173b32]">Transit maritime & Marchandises</h2>
                    <p className="text-xs text-[#81918b]">Données d’identification du fret (Port Autonome de Conakry, Kamsar, POL/POD).</p>
                  </div>
                </div>

                <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="N° dossier client" field="clientDossierNumber" form={form} setForm={setForm} required invalid={showValidation && !form.clientDossierNumber} placeholder="ex: CKYSI26000340" />
                  <ReferenceSelectOrInput label="Client / Destinataire" field="client" category="client" form={form} setForm={setForm} references={references} required invalid={showValidation && !form.client} placeholder="ex: Guinean Birimian Gold" />
                  <Field label="N° BL / LTA" field="blLtaNumber" form={form} setForm={setForm} required invalid={showValidation && !form.blLtaNumber} placeholder="ex: HLCUNG12604AUQG1" />
                  <Field label="Nature de marchandise" field="cargoNature" form={form} setForm={setForm} required invalid={showValidation && !form.cargoNature} placeholder="ex: Cyanure, Tubes d'acier" />
                  <ReferenceSelect label="Mode transport" field="transportMode" category="mode_transport" form={form} setForm={setForm} references={references} required invalid={showValidation && !form.transportMode} />
                  <Field label="Date ETA" field="eta" form={form} setForm={setForm} required type="date" invalid={showValidation && !form.eta} />
                  <ReferenceSelectOrInput label="Port d’origine (POL)" field="originPort" category="port_origine" form={form} setForm={setForm} references={references} required invalid={showValidation && !form.originPort} placeholder="ex: Ningbo-China" />
                  <ReferenceSelectOrInput label="Port de destination (POD)" field="destinationPort" category="port_destination" form={form} setForm={setForm} references={references} required invalid={showValidation && !form.destinationPort} placeholder="ex: Port Autonome de Conakry" />
                  <Field label="Conteneur(s)" field="container" form={form} setForm={setForm} placeholder="ex: 04TC20', 02TC40'" invalid={showValidation && !form.container && !form.bulk} />
                  <Field label="Vrac / Colis (PKG)" field="bulk" form={form} setForm={setForm} placeholder="ex: 56 PKG, 120 Tonnes" invalid={showValidation && !form.container && !form.bulk} />
                  <Field label="Date sortie marchandises" field="goodsReleaseDate" form={form} setForm={setForm} required type="date" invalid={showValidation && !form.goodsReleaseDate} />
                  <Field label="N° déclaration (Sydonia)" field="declarationNumber" form={form} setForm={setForm} required invalid={showValidation && !form.declarationNumber} placeholder="ex: S 142- 27/07/2026" />
                  <Field label="N° bulletin (BLD)" field="bulletinNumber" form={form} setForm={setForm} required invalid={showValidation && !form.bulletinNumber} placeholder="ex: L 1774 Du 28/07/2026" />
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

            {/* Boutons d'action */}
            <div className="flex items-center justify-between pt-2">
              {!isNew && perms.canDeleteDossier && (
                <Button type="button" variant="ghost" onClick={() => removeMutation.mutate({ id })} className="text-rose-600 hover:bg-rose-50 rounded-xl">
                  <Trash2 size={16} className="mr-1.5" /> Supprimer ce dossier
                </Button>
              )}
              <div className="ml-auto flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setLocation("/dossiers")} className="rounded-xl border-[#dfe8e4]">
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] px-6">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="mr-2 animate-spin" />}
                  <Save size={16} className="mr-2" /> {isNew ? "Créer le dossier" : "Enregistrer les modifications"}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

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
                        dossierId: id,
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

                      <div className="text-right">
                        <span className="text-lg font-bold text-[#102c26]">{inv.amountTtc.toLocaleString()} {inv.currency}</span>
                        {perms.canViewMargin && (
                          <p className="text-[11px] text-emerald-700 font-semibold">Marge estimée : +{inv.estimatedMargin.toLocaleString()} {inv.currency}</p>
                        )}
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
                  <Button onClick={() => createTaskMutation.mutate({ dossierId: id, title: newTaskTitle, assignedTo: newTaskAssignee })} className="rounded-xl bg-[#0b3b32] text-white">
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
              <Button size="sm" onClick={() => newComment.trim() && addCommentMutation.mutate({ dossierId: id, message: newComment.trim() })} className="rounded-xl bg-[#0b3b32] text-white">
                Envoyer
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ONGLET 5: Audit Trail & Historique (Gated via perms.canViewAudit) */}
        {perms.canViewAudit && (
          <TabsContent value="audit" className="space-y-4">
            <div>
              <h2 className="font-[Georgia] text-lg font-semibold text-[#173b32]">Journal d'Audit & Traçabilité Complète</h2>
              <p className="text-xs text-muted-foreground">Historique horodaté des changements de statuts, ajouts de documents et modifications (preuve légale et conformité).</p>
            </div>

            <div className="relative pl-6 border-l-2 border-emerald-900/20 space-y-4 py-2">
              {auditQuery.data?.map(entry => (
                <div key={entry.id} className="relative">
                  <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-emerald-700 ring-4 ring-white" />
                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950">{entry.fieldChanged}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString("fr-FR")}</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      <strong>{entry.authorName || "Système"}</strong> : {entry.previousValue ? `${entry.previousValue} ➔ ` : ""}{entry.newValue}
                    </p>
                    {entry.comment && <p className="text-[11px] text-muted-foreground italic">« {entry.comment} »</p>}
                  </div>
                </div>
              ))}
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
          onSuccess={() => utils.dossier.get.invalidate({ id })}
        />
      )}
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
