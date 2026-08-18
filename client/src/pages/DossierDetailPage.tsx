import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Loader2,
  Save,
  Trash2,
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
}: {
  label: string;
  field: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  required?: boolean;
  type?: string;
  invalid?: boolean;
  placeholder?: string;
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
        aria-invalid={invalid}
        aria-describedby={invalid ? `${field}-error` : undefined}
        onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
        className={`h-10 rounded-xl bg-white text-sm focus-visible:ring-[#2f826d]/30 ${
          invalid ? "border-[#cf5c46]" : "border-[#dfe9e4]"
        }`}
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
}) {
  const choices = references.filter(item => item.category === category);
  const datalistId = `list-${field}-${category}`;

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
          placeholder={placeholder || "Sélectionner ou saisir…"}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${field}-error` : undefined}
          onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
          className={`h-10 w-full rounded-xl border bg-white px-3 text-sm text-[#365048] outline-none transition focus:ring-2 focus:ring-[#2f826d]/30 ${
            invalid ? "border-[#cf5c46]" : "border-[#dfe9e4]"
          }`}
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
}: {
  label: string;
  field: string;
  category: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  references: Array<{ id: number; category: string; label: string }>;
  required?: boolean;
  invalid?: boolean;
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
        aria-invalid={invalid}
        aria-describedby={invalid ? `${field}-error` : undefined}
        onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
        className={`h-10 w-full rounded-xl border bg-white px-3 text-sm text-[#365048] outline-none transition focus:ring-2 focus:ring-[#2f826d]/30 ${
          invalid ? "border-[#cf5c46]" : "border-[#dfe9e4]"
        }`}
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
  const { data: dossier, isLoading, error: dossierError } = trpc.dossier.get.useQuery(
    { id },
    { enabled: !isNew && Number.isFinite(id) }
  );
  const { data: references = [], error: referencesError } = trpc.reference.list.useQuery();
  const { data: dossiers = [] } = trpc.dossier.list.useQuery();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(blank);
  const [showValidation, setShowValidation] = useState(false);

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

  const payload = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.entries(form)
          .filter(([key]) => key !== "eta" && key !== "goodsReleaseDate")
          .map(([key, value]) => [key, toText(value)])
      ),
      eta: toDate(form.eta),
      goodsReleaseDate: toDate(form.goodsReleaseDate),
    }),
    [form]
  );

  const create = trpc.dossier.create.useMutation({
    onSuccess: (created: any) => {
      toast.success(`${created.dossierNumber} créé avec succès`);
      utils.dossier.list.invalidate();
      utils.dashboard.get.invalidate();
      setLocation(`/dossiers/${created.id}`);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const update = trpc.dossier.update.useMutation({
    onSuccess: () => {
      toast.success("Dossier enregistré avec succès");
      utils.dossier.get.invalidate({ id });
      utils.dossier.list.invalidate();
      utils.dashboard.get.invalidate();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const remove = trpc.dossier.remove.useMutation({
    onSuccess: () => {
      toast.success("Dossier supprimé");
      utils.dossier.list.invalidate();
      utils.dashboard.get.invalidate();
      setLocation("/dossiers");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const currentIndex = dossiers.findIndex(item => item.id === id);
  const previous = currentIndex > 0 ? dossiers[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 && currentIndex < dossiers.length - 1 ? dossiers[currentIndex + 1] : undefined;

  const requiredFields = [
    { key: "clientDossierNumber", label: "N° dossier client", valid: Boolean(form.clientDossierNumber) },
    { key: "client", label: "Client / Importateur", valid: Boolean(form.client) },
    { key: "blLtaNumber", label: "N° BL / LTA", valid: Boolean(form.blLtaNumber) },
    { key: "cargoNature", label: "Nature marchandise", valid: Boolean(form.cargoNature) },
    { key: "transportMode", label: "Mode de transport", valid: Boolean(form.transportMode) },
    { key: "eta", label: "Date ETA", valid: Boolean(form.eta) },
    { key: "originPort", label: "Port d’origine (POL)", valid: Boolean(form.originPort) },
    { key: "destinationPort", label: "Port destination (POD)", valid: Boolean(form.destinationPort) },
    { key: "packaging", label: "Conteneur ou Vrac", valid: Boolean(form.container || form.bulk) },
    { key: "goodsReleaseDate", label: "Sortie marchandises", valid: Boolean(form.goodsReleaseDate) },
    { key: "declarationNumber", label: "N° déclaration (Sydonia)", valid: Boolean(form.declarationNumber) },
    { key: "bulletinNumber", label: "N° bulletin (BLD)", valid: Boolean(form.bulletinNumber) },
  ];

  const missingCount = requiredFields.filter(f => !f.valid).length;
  const completionRate = Math.round(((requiredFields.length - missingCount) / requiredFields.length) * 100);
  const liveStatus = missingCount === 0 ? "Régularisé" : "À régulariser";
  const saving = create.isPending || update.isPending;

  if (!isNew && isLoading)
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-[600px] rounded-3xl" />
      </div>
    );

  if (!isNew && !dossier)
    return (
      <Card className="mx-auto max-w-xl border-0 bg-white">
        <CardContent className="p-10 text-center">
          <AlertTriangle className="mx-auto text-[#c4543e]" />
          <p className="mt-4 font-semibold">{dossierError ? "Impossible de charger ce dossier" : "Dossier introuvable"}</p>
          <p className="mt-2 text-sm text-[#71817b]">{dossierError?.message}</p>
          <Button className="mt-4" onClick={() => setLocation("/dossiers")}>
            Retour aux dossiers
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="mx-auto max-w-[1540px] space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <button
            onClick={() => setLocation("/dossiers")}
            className="mb-3 flex items-center gap-1 text-xs font-semibold text-[#3f7869] hover:underline"
          >
            <ArrowLeft size={14} />
            Retour aux dossiers
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#81928c]">
            {isNew ? "Nouvelle opération de transit" : "Fiche détaillée du dossier"}
          </p>
          <h1 className="mt-1 font-[Georgia] text-3xl font-semibold text-[#15372f]">
            {isNew ? "Créer un dossier" : dossier?.dossierNumber}
          </h1>
          <p className="mt-1 text-sm text-[#73827d]">
            {isNew
              ? "Numérotation séquentielle automatique (DOS-xxxx) attribuée à l’enregistrement."
              : `Dernière mise à jour le ${new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(dossier!.updatedAt))}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`border-0 px-3 py-1.5 ${pillStyle(liveStatus)}`}>{liveStatus}</Badge>
          <Badge className={`border-0 px-3 py-1.5 ${pillStyle(liveStatus)}`}>
            {liveStatus === "Régularisé" ? "Priorité basse" : "Priorité haute"}
          </Badge>
          {!isNew && (
            <div className="ml-2 flex rounded-xl border border-[#dfebe5] bg-white p-1">
              <button
                disabled={!previous}
                onClick={() => previous && setLocation(`/dossiers/${previous.id}`)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#386157] disabled:opacity-30 hover:bg-[#edf5f1]"
                title="Dossier précédent"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                disabled={!next}
                onClick={() => next && setLocation(`/dossiers/${next.id}`)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#386157] disabled:opacity-30 hover:bg-[#edf5f1]"
                title="Dossier suivant"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Form and Sidebar Grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <form
          noValidate
          onSubmit={event => {
            event.preventDefault();
            if (missingCount > 0) {
              setShowValidation(true);
              toast.error(`Veuillez compléter les ${missingCount} champ(s) obligatoire(s) pour la conformité.`);
              return;
            }
            setShowValidation(false);
            if (isNew) create.mutate(payload);
            else update.mutate({ id, data: payload });
          }}
          className="space-y-5"
        >
          {referencesError && (
            <div role="alert" className="rounded-xl border border-[#f2c6ba] bg-[#fff3ef] p-3 text-sm text-[#aa4934]">
              Les référentiels n’ont pas pu être chargés : {referencesError.message}
            </div>
          )}

          {/* Section 1: Informations de Transit & Transport */}
          <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f1ed] text-[#1d7764]">
                  <FileCheck2 size={18} />
                </div>
                <div>
                  <h2 className="font-[Georgia] text-xl font-semibold text-[#173b32]">Informations de transit & fret</h2>
                  <p className="text-xs text-[#81918b]">
                    Données d’identification du fret maritime / aérien (Port de Conakry, POL/POD, conteneurs/vrac).
                  </p>
                </div>
              </div>

              <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="N° dossier client"
                  field="clientDossierNumber"
                  form={form}
                  setForm={setForm}
                  required
                  invalid={showValidation && !form.clientDossierNumber}
                  placeholder="ex: CKYSI26000340"
                />
                <ReferenceSelectOrInput
                  label="Client / Destinataire"
                  field="client"
                  category="client"
                  form={form}
                  setForm={setForm}
                  references={references}
                  required
                  invalid={showValidation && !form.client}
                  placeholder="ex: Guinean Birimian Gold"
                />
                <Field
                  label="N° BL / LTA"
                  field="blLtaNumber"
                  form={form}
                  setForm={setForm}
                  required
                  invalid={showValidation && !form.blLtaNumber}
                  placeholder="ex: HLCUNG12604AUQG1"
                />
                <Field
                  label="Nature de marchandise"
                  field="cargoNature"
                  form={form}
                  setForm={setForm}
                  required
                  invalid={showValidation && !form.cargoNature}
                  placeholder="ex: Cyanure de sodium, Tubes acier"
                />
                <ReferenceSelect
                  label="Mode transport"
                  field="transportMode"
                  category="mode_transport"
                  form={form}
                  setForm={setForm}
                  references={references}
                  required
                  invalid={showValidation && !form.transportMode}
                />
                <Field
                  label="Date ETA"
                  field="eta"
                  form={form}
                  setForm={setForm}
                  required
                  type="date"
                  invalid={showValidation && !form.eta}
                />
                <ReferenceSelectOrInput
                  label="Port d’origine (POL)"
                  field="originPort"
                  category="port_origine"
                  form={form}
                  setForm={setForm}
                  references={references}
                  required
                  invalid={showValidation && !form.originPort}
                  placeholder="ex: Ningbo port-china"
                />
                <ReferenceSelectOrInput
                  label="Port de destination (POD)"
                  field="destinationPort"
                  category="port_destination"
                  form={form}
                  setForm={setForm}
                  references={references}
                  required
                  invalid={showValidation && !form.destinationPort}
                  placeholder="ex: Port Autonome de Conakry"
                />
                <Field
                  label="Conteneur(s)"
                  field="container"
                  form={form}
                  setForm={setForm}
                  placeholder="ex: 04TC20', 02TC40'"
                  invalid={showValidation && !form.container && !form.bulk}
                />
                <Field
                  label="Vrac / Colis (PKG)"
                  field="bulk"
                  form={form}
                  setForm={setForm}
                  placeholder="ex: 56 PKG, 120 Tonnes"
                  invalid={showValidation && !form.container && !form.bulk}
                />
                <Field
                  label="Date sortie marchandises"
                  field="goodsReleaseDate"
                  form={form}
                  setForm={setForm}
                  required
                  type="date"
                  invalid={showValidation && !form.goodsReleaseDate}
                />
                <Field
                  label="N° déclaration (Sydonia)"
                  field="declarationNumber"
                  form={form}
                  setForm={setForm}
                  required
                  invalid={showValidation && !form.declarationNumber}
                  placeholder="ex: S 142- 27/07/2026"
                />
                <Field
                  label="N° bulletin (BLD)"
                  field="bulletinNumber"
                  form={form}
                  setForm={setForm}
                  required
                  invalid={showValidation && !form.bulletinNumber}
                  placeholder="ex: L 1774 Du 28/07/2026"
                />
                <Field
                  label="N° déclaration définitive"
                  field="finalDeclarationNumber"
                  form={form}
                  setForm={setForm}
                  placeholder="ex: C 1398-2026"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Procédures Douanières & Suivi Opérationnel Guinée */}
          <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-[Georgia] text-xl font-semibold text-[#173b32]">
                Procédures douanières & suivi terrain (Guinée / Ouest-Africain)
              </h2>
              <p className="mt-1 text-xs text-[#81918b]">
                Statuts SYDONIA, DDI (GUCEG), opérations Port Autonome de Conakry, régimes et alertes terrain.
              </p>

              <div className="mt-5 grid gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                <ReferenceSelect
                  label="Régime douanier"
                  field="regime"
                  category="regime"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Statut douane (SYDONIA / DDI)"
                  field="customsStatus"
                  category="statut_douane"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Statut portuaire (PAC / Bolloré)"
                  field="portStatus"
                  category="statut_port"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Statut financier & devises"
                  field="financialStatus"
                  category="statut_financier"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Statut documentaire"
                  field="documentStatus"
                  category="statut_documentaire"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Alerte terrain"
                  field="fieldAlert"
                  category="alerte_terrain"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Opération terrain en cours"
                  field="fieldOperation"
                  category="operation_terrain"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Prochaine action"
                  field="nextAction"
                  category="prochaine_action"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Lieu de livraison"
                  field="deliveryLocation"
                  category="lieu_livraison"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Responsable dossier"
                  field="responsible"
                  category="responsable"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Déclarant IGS"
                  field="declarant"
                  category="declarant_igs"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
                <ReferenceSelect
                  label="Service"
                  field="service"
                  category="service"
                  form={form}
                  setForm={setForm}
                  references={references}
                />
              </div>

              <div className="mt-5 space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-[#516760]">
                  Notes internes, instructions particulières & contacts
                </Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                  className="min-h-24 rounded-xl border-[#dfe9e4]"
                  placeholder="Précisions client, autorisations matières dangereuses, quitus fiscal, montant en GNF/USD…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
            {!isNew ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Supprimer définitivement le dossier ${dossier?.dossierNumber} ?`))
                    remove.mutate({ id });
                }}
                disabled={remove.isPending}
                className="justify-start text-[#bc4f38] hover:bg-[#fff0eb] hover:text-[#a23c27]"
              >
                <Trash2 className="mr-2" size={16} />
                Supprimer le dossier
              </Button>
            ) : (
              <span />
            )}

            <Button
              type="submit"
              disabled={saving}
              className="h-11 rounded-xl bg-[#0f4035] px-6 text-white hover:bg-[#195847]"
            >
              {saving ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Save className="mr-2" size={16} />}
              {isNew ? "Créer le dossier" : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>

        {/* Right Sidebar: Automatic Compliance Engine */}
        <aside className="space-y-4">
          <Card className="border-0 bg-[#123e34] text-white shadow-[0_10px_28px_rgba(23,54,46,0.12)]">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d9a94b]">Moteur de régularisation</p>
              <h2 className="mt-2 font-[Georgia] text-xl font-semibold">État de conformité</h2>

              <div className="mt-4 rounded-xl bg-white/10 p-4">
                <p className="text-2xl font-semibold">{liveStatus}</p>
                <p className="mt-1 text-xs leading-5 text-[#c4d9d1]">
                  {missingCount === 0
                    ? "Dossier 100% complet et conforme."
                    : `${missingCount} élément(s) requis à compléter pour régulariser.`}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-[#b7d0c6]">Taux de complétude</span>
                <span className="font-semibold text-white">{completionRate}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[#d9a94b] transition-all duration-300"
                  style={{ width: `${Math.max(4, completionRate)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Checklist Card */}
          <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#81928c]">
                Critères obligatoires ({requiredFields.filter(f => f.valid).length}/{requiredFields.length})
              </p>
              <div className="mt-3 space-y-2">
                {requiredFields.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className={f.valid ? "text-[#325248]" : "text-[#b8523c] font-medium"}>{f.label}</span>
                    {f.valid ? (
                      <Check className="h-4 w-4 shrink-0 text-[#177a62]" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-[#c75842]" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
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
