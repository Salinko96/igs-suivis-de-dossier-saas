import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import { KpiDetailModal, KpiType } from "@/components/KpiDetailModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useFinanceRealtime } from "@/hooks/useFinanceRealtime";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  FileUp,
  History,
  Info,
  LineChart,
  Loader2,
  Lock,
  PieChart,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function FinancesPage() {
  useFinanceRealtime();

  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const currentUser = meQuery.data;
  const isAdminOrComptable = currentUser?.role === "admin" || currentUser?.role === "comptable" || currentUser?.role === "manager";

  // Sub-Navigation Tabs
  const [activeTab, setActiveTab] = useState<"invoices" | "profitability" | "treasury" | "rates">("invoices");

  // Invoices Server Pagination & Filters
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(25);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceReconcileFilter, setInvoiceReconcileFilter] = useState("all");

  const summaryQuery = trpc.finance.summary.useQuery();
  const invoicesPaginatedQuery = trpc.finance.listInvoicesPaginated.useQuery({
    page: invoicePage,
    limit: invoiceLimit,
    search: invoiceSearch.trim() || undefined,
    status: invoiceStatusFilter !== "all" ? invoiceStatusFilter : undefined,
    reconciliationStatus: invoiceReconcileFilter !== "all" ? invoiceReconcileFilter : undefined,
  });

  const dossiersQuery = trpc.dossier.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

  // Lazy queries for secondary tabs
  const profitabilityQuery = trpc.finance.profitability.useQuery(undefined, {
    enabled: activeTab === "profitability" || activeTab === "invoices",
    staleTime: 1000 * 60 * 5,
  });

  const treasuryFlowQuery = trpc.finance.treasuryFlow.useQuery(undefined, {
    enabled: activeTab === "treasury",
    staleTime: 1000 * 60 * 5,
  });

  const ratesHistoryQuery = trpc.finance.exchangeRatesHistory.useQuery(undefined, {
    enabled: activeTab === "rates",
    staleTime: 1000 * 60 * 5,
  });

  // Multi-Currency Switcher State
  const [displayCurrency, setDisplayCurrency] = useState<"GNF" | "USD">("GNF");

  // KPI Drilldown Modal State
  const [activeKpiModal, setActiveKpiModal] = useState<KpiType | null>(null);

  // Exchange Rate Modal State
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [newExchangeRate, setNewExchangeRate] = useState(8650);
  const [overrideReason, setOverrideReason] = useState("");

  // 3-Way Reconciliation Modal State
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcilingInvoice, setReconcilingInvoice] = useState<any | null>(null);
  const [reconciliationStatus, setReconciliationStatus] = useState<"non_rapproche" | "partiel" | "rapproche">("rapproche");
  const [reconciliationRef, setReconciliationRef] = useState("");
  const [reconciliationNotes, setReconciliationNotes] = useState("");

  // Create Invoice Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDossierId, setSelectedDossierId] = useState<number | undefined>();
  const [invoiceType, setInvoiceType] = useState<"Proforma" | "Definitive">("Proforma");
  const [invoiceCurrency, setInvoiceCurrency] = useState("GNF");
  const [invoiceAmountHt, setInvoiceAmountHt] = useState(25000000);
  const [invoiceCustomsDuties, setInvoiceCustomsDuties] = useState(45000000);
  const [invoicePortFees, setInvoicePortFees] = useState(12000000);
  const [invoiceStorageDemurrage, setInvoiceStorageDemurrage] = useState(3000000);
  const [invoiceStatus, setInvoiceStatus] = useState<"Proforma" | "Émise" | "Payée">("Proforma");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Payment Recording Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Virement bancaire Ecobank / Vistabank");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAmount, setPaidAmount] = useState<number | undefined>();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBase64, setProofBase64] = useState<string | null>(null);

  const activeRate = summaryQuery.data?.exchangeRate || 8650;

  // Mutations
  const syncRateMutation = trpc.finance.syncExchangeRate.useMutation({
    onSuccess: (res) => {
      toast.success(`Taux synchronisé : 1 USD = ${res.rate.toLocaleString("fr-FR")} GNF (${res.provider})`);
      ratesHistoryQuery.refetch();
      summaryQuery.refetch();
      profitabilityQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Erreur synchronisation : ${err.message}`);
    },
  });

  const overrideRateMutation = trpc.finance.overrideExchangeRate.useMutation({
    onSuccess: (res) => {
      toast.success(`Dérogation enregistrée : 1 USD = ${res.rate.toLocaleString("fr-FR")} GNF`);
      setRateModalOpen(false);
      setOverrideReason("");
      ratesHistoryQuery.refetch();
      summaryQuery.refetch();
      profitabilityQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Erreur dérogation : ${err.message}`);
    },
  });

  const reconcileMutation = trpc.finance.reconcile.useMutation({
    onSuccess: (res) => {
      toast.success(`Rapprochement validé pour la facture ${res.invoiceNumber} !`);
      setReconcileModalOpen(false);
      setReconcilingInvoice(null);
      invoicesPaginatedQuery.refetch();
      summaryQuery.refetch();
      profitabilityQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Erreur rapprochement : ${err.message}`);
    },
  });

  const createInvoiceMutation = trpc.finance.createInvoice.useMutation({
    onSuccess: (created) => {
      toast.success(`Facture ${created.invoiceNumber} générée avec succès !`);
      setCreateOpen(false);
      invoicesPaginatedQuery.refetch();
      summaryQuery.refetch();
      profitabilityQuery.refetch();
      utils.dossier.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Erreur de création : ${err.message}`);
    },
  });

  const recordPaymentMutation = trpc.finance.recordPayment.useMutation({
    onSuccess: (res) => {
      toast.success(`Paiement enregistré ! Quittance ${res.receiptNumber || ""} générée.`);
      setPaymentModalOpen(false);
      setPayingInvoice(null);
      invoicesPaginatedQuery.refetch();
      summaryQuery.refetch();
      profitabilityQuery.refetch();
      utils.dossier.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Erreur d'enregistrement : ${err.message}`);
    },
  });

  const data = summaryQuery.data || {
    totalCA_GNF: 0,
    totalCA_USD: 0,
    totalMargin_GNF: 0,
    totalMargin_USD: 0,
    totalDisbursements_GNF: 0,
    totalCustomsDuties_GNF: 0,
    totalPortFees_GNF: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalDemurrageRisk: 0,
    exchangeRate: 8650,
    invoices: [],
  };

  const profitability = profitabilityQuery.data;
  const paginatedInvoices = invoicesPaginatedQuery.data?.items || [];
  const totalInvoicesCount = invoicesPaginatedQuery.data?.total || 0;
  const totalPages = invoicesPaginatedQuery.data?.totalPages || 1;

  const formatMoney = (amountInOriginalGnf: number, originalCurrency: string = "GNF") => {
    if (displayCurrency === "USD") {
      const inUsd = originalCurrency === "USD" ? amountInOriginalGnf : amountInOriginalGnf / activeRate;
      return `$ ${inUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const inGnf = originalCurrency === "USD" ? amountInOriginalGnf * activeRate : amountInOriginalGnf;
      return `${Math.round(inGnf).toLocaleString("fr-FR")} GNF`;
    }
  };

  const computedTva = Math.round(invoiceAmountHt * 0.18);
  const computedTtc = invoiceAmountHt + computedTva;
  const computedDisbursements = invoiceCustomsDuties + invoicePortFees + invoiceStorageDemurrage;
  const computedGrandTotal = computedTtc + computedDisbursements;

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDossierId) {
      toast.error("Veuillez sélectionner un dossier.");
      return;
    }
    const targetDossier = dossiersQuery.data?.find(d => d.id === selectedDossierId);
    createInvoiceMutation.mutate({
      dossierId: selectedDossierId,
      client: targetDossier?.client || "Client IGS",
      currency: invoiceCurrency,
      invoiceType,
      exchangeRate: activeRate,
      amountHt: invoiceAmountHt,
      amountTva: computedTva,
      amountTtc: computedTtc,
      disbursementsAmount: computedDisbursements,
      customsDutiesAmount: invoiceCustomsDuties,
      portFeesAmount: invoicePortFees,
      storageAndDemurrageFees: invoiceStorageDemurrage,
      status: invoiceStatus,
      dueDate: invoiceDueDate ? new Date(invoiceDueDate) : undefined,
      notes: invoiceNotes || undefined,
    });
  };

  const handleOpenPayment = (invoice: any) => {
    setPayingInvoice(invoice);
    setPaidAmount(invoice.amountTtc + (invoice.disbursementsAmount || 0));
    setPaymentReference(`VIR-ECOBANK-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!payingInvoice) return;
    recordPaymentMutation.mutate({
      id: payingInvoice.id,
      paidAmount: paidAmount ? Number(paidAmount) : undefined,
      paymentMethod,
      paymentReference,
      proofUrl: proofBase64,
    });
  };

  const handleOpenReconcile = (invoice: any) => {
    setReconcilingInvoice(invoice);
    setReconciliationStatus(invoice.reconciliationStatus || "rapproche");
    setReconciliationRef(invoice.reconciliationRef || invoice.paymentReference || `REC-BANK-${invoice.id}`);
    setReconciliationNotes(invoice.notes || "");
    setReconcileModalOpen(true);
  };

  const handleConfirmReconciliation = () => {
    if (!reconcilingInvoice) return;
    reconcileMutation.mutate({
      invoiceId: reconcilingInvoice.id,
      reconciliationStatus,
      reconciliationRef: reconciliationRef.trim() || undefined,
      notes: reconciliationNotes.trim() || undefined,
    });
  };

  const handlePrintReceipt = (inv: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour imprimer la quittance / facture.");
      return;
    }
    const isPaid = inv.status === "Payée";
    const totalDisb = inv.disbursementsAmount || 0;
    const grandTotal = inv.amountTtc + totalDisb;
    const usdEquiv = (grandTotal / (inv.exchangeRate || activeRate)).toFixed(2);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isPaid ? "Quittance de Paiement" : "Facture Proforma"} - ${inv.invoiceNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #102c26; margin: 0; padding: 20px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2.5px solid #0b3b32; padding-bottom: 18px; }
          .logo-title { font-size: 22px; font-weight: 800; color: #0b3b32; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #52736b; margin-top: 2px; }
          .doc-badge { background: ${isPaid ? '#0b3b32' : '#d9a94b'}; color: ${isPaid ? '#ffffff' : '#102c26'}; padding: 6px 14px; font-size: 13px; font-weight: bold; border-radius: 6px; display: inline-block; }
          .client-box { margin-top: 22px; padding: 14px 18px; background: #f4f8f6; border-radius: 10px; border-left: 4px solid #0b3b32; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th { background: #0b3b32; color: #ffffff; padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          td { padding: 10px 12px; border-bottom: 1px solid #e1ebe7; font-size: 12px; }
          .text-right { text-align: right; }
          .total-box { margin-top: 24px; padding: 16px; background: #fbfdfc; border: 1px solid #e1ebe7; border-radius: 10px; text-align: right; }
          .total-row { font-size: 17px; font-weight: 800; color: #0b3b32; margin-top: 8px; }
          .receipt-tag { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-top: 8px; background: ${isPaid ? '#d1fae5' : '#fef3c7'}; color: ${isPaid ? '#065f46' : '#92400e'}; }
          .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #789088; border-top: 1px solid #e1ebe7; padding-top: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo-title">IBRAHIMA GOLD SERVICE (IGS) S.A.R.L</div>
            <div class="subtitle">Transit Maritime • Dédouanement SYDONIA World • Logistique Port Autonome de Conakry</div>
            <div class="subtitle">RCCM / GC-KAL / 012.345A / 2020 • NIF : 004829104A • Conakry, République de Guinée</div>
          </div>
          <div class="text-right">
            <div class="doc-badge">${isPaid ? "QUITTANCE DE PAIEMENT" : "FACTURE PROFORMA"}</div>
            <div style="font-weight: bold; margin-top: 6px; font-size: 14px;">N° ${inv.invoiceNumber}</div>
            ${inv.receiptNumber ? `<div style="font-size: 11px; color: #065f46; font-weight: bold;">Réf. Reçu : ${inv.receiptNumber}</div>` : ""}
            <div style="font-size: 11px; color: #666; margin-top: 2px;">Date d'émission : ${new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        </div>

        <div class="client-box">
          <div style="font-size: 10px; font-weight: bold; color: #52736b; text-transform: uppercase;">DESTINATAIRE / CLIENT :</div>
          <div style="font-size: 16px; font-weight: bold; color: #0b3b32; margin-top: 2px;">${inv.client}</div>
          <div style="font-size: 12px; color: #444; margin-top: 2px;">Dossier de transit associé : <strong>Dossier #${inv.dossierId}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>DÉSIGNATION DES PRESTATIONS & DÉBOURS DOUANIERS</th>
              <th class="text-right">MONTANT (${inv.currency})</th>
              <th class="text-right">ÉQUIVALENT USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Honoraires & Prestations de Transit IGS</strong><br/>
                <span style="font-size: 10px; color: #666;">Prise en charge, déclaration SYDONIA World, opérations terrain PAC & suivi</span>
              </td>
              <td class="text-right font-bold">${inv.amountHt.toLocaleString("fr-FR")} ${inv.currency}</td>
              <td class="text-right">$ ${(inv.amountHt / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
            </tr>
            <tr>
              <td>
                <strong>TVA Légale (18%)</strong><br/>
                <span style="font-size: 10px; color: #666;">Taxe sur la Valeur Ajoutée sur prestations de services</span>
              </td>
              <td class="text-right">${inv.amountTva.toLocaleString("fr-FR")} ${inv.currency}</td>
              <td class="text-right">$ ${(inv.amountTva / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
            </tr>
            ${inv.customsDutiesAmount ? `
              <tr>
                <td>
                  <strong>Débours : Droits & Taxes de Douane (Trésor Public)</strong><br/>
                  <span style="font-size: 10px; color: #666;">Liquidation douanière (BLD) / SYDONIA</span>
                </td>
                <td class="text-right font-bold text-amber-900">${inv.customsDutiesAmount.toLocaleString("fr-FR")} ${inv.currency}</td>
                <td class="text-right">$ ${(inv.customsDutiesAmount / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
              </tr>
            ` : ""}
            ${inv.portFeesAmount ? `
              <tr>
                <td>
                  <strong>Débours : Redevances Portuaires & Manutention (PAC / Conakry Terminal)</strong><br/>
                  <span style="font-size: 10px; color: #666;">Frais de quai, acconage et traction terminal</span>
                </td>
                <td class="text-right font-bold text-amber-900">${inv.portFeesAmount.toLocaleString("fr-FR")} ${inv.currency}</td>
                <td class="text-right">$ ${(inv.portFeesAmount / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
              </tr>
            ` : ""}
            ${inv.storageAndDemurrageFees ? `
              <tr>
                <td>
                  <strong>Débours : Magasinage & Surestaries Portuaires</strong><br/>
                  <span style="font-size: 10px; color: #666;">Frais de séjour conteneur</span>
                </td>
                <td class="text-right font-bold text-rose-900">${inv.storageAndDemurrageFees.toLocaleString("fr-FR")} ${inv.currency}</td>
                <td class="text-right">$ ${(inv.storageAndDemurrageFees / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
              </tr>
            ` : ""}
          </tbody>
        </table>

        <div class="total-box">
          <div>Honoraires Transit TTC : <strong>${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency}</strong></div>
          <div>Total Débours Avancés PAC/Douane : <strong>${totalDisb.toLocaleString("fr-FR")} ${inv.currency}</strong></div>
          <div class="total-row">TOTAL GÉNÉRAL À RECOUVRER : ${grandTotal.toLocaleString("fr-FR")} ${inv.currency} (≈ $ ${usdEquiv})</div>
          ${isPaid ? `
            <div class="receipt-tag">✓ RÈGLEMENT EFFECTUÉ — ${inv.paymentMethod || "Virement"} (Réf: ${inv.paymentReference || "N/A"})</div>
          ` : `
            <div class="receipt-tag" style="background:#fee2e2; color:#991b1b;">EN ATTENTE D'ENCAISSEMENT</div>
          `}
        </div>

        <div class="footer">
          Document émis par le système sécurisé IGS Dossiers. Pour toute contestation, contacter la comptabilité au +224 620 00 00 00.
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Fil d'Ariane & Navigation */}
        <Breadcrumbs
          items={[
            { label: "Accueil", href: "/" },
            { label: "Finances & Facturation", active: true },
          ]}
          backHref="/"
        />

        {/* Alerte Proactive : Dossiers Régularisés Non Facturés */}
        {profitability && profitability.unbilledDossiersCount > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-900 grid place-items-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-amber-950 text-sm">
                  {profitability.unbilledDossiersCount} dossier(s) régularisé(s) sans facture définitive émise !
                </h3>
                <p className="text-xs text-amber-800">
                  Dette potentielle non recouvrée : les marchandises sont sorties du quai sans émission de facture définitive.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setActiveTab("invoices")}
              className="rounded-xl bg-amber-800 text-white hover:bg-amber-900 text-xs font-bold shrink-0 shadow-sm"
            >
              Émettre les Factures →
            </Button>
          </div>
        )}

        {/* En-tête Finances avec Multi-Devises & Gestion Taux */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d9a94b]">
                Direction Financière & Comptabilité
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-800 text-amber-900 font-semibold">
                Fatoumata Camara
              </Badge>
            </div>
            <h1 className="mt-1 font-[Georgia] text-2xl sm:text-3xl font-bold tracking-tight text-[#102c26]">
              Finances, Facturation & Débours
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#627670]">
              Liaison automatique dossier ↔ facture, analyse de rentabilité par client, trésorerie et taux de change immuable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Taux de Change Actif & Bouton Paramétrage */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewExchangeRate(activeRate);
                setRateModalOpen(true);
              }}
              className="h-9 rounded-xl border-gray-200 bg-white text-xs text-emerald-950 hover:bg-emerald-50 gap-1.5 shadow-sm"
            >
              <Coins size={14} className="text-[#d9a94b]" />
              <span>1 USD = <strong>{activeRate.toLocaleString("fr-FR")} GNF</strong></span>
              <Edit size={11} className="text-muted-foreground" />
            </Button>

            {/* Sélecteur de Devise GNF / USD */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <Button
                variant={displayCurrency === "GNF" ? "default" : "ghost"}
                size="sm"
                onClick={() => setDisplayCurrency("GNF")}
                className={`rounded-lg text-xs h-8 ${displayCurrency === "GNF" ? "bg-[#0b3b32] text-white" : ""}`}
              >
                🇬🇳 GNF
              </Button>
              <Button
                variant={displayCurrency === "USD" ? "default" : "ghost"}
                size="sm"
                onClick={() => setDisplayCurrency("USD")}
                className={`rounded-lg text-xs h-8 ${displayCurrency === "USD" ? "bg-[#0b3b32] text-white" : ""}`}
              >
                🇺🇸 USD ($)
              </Button>
            </div>

            {/* Bouton Émettre Facture */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  disabled={!isAdminOrComptable}
                  title={!isAdminOrComptable ? "Réservé aux administrateurs et comptables" : "Créer une nouvelle facture"}
                  className="h-9 rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs shadow-sm disabled:opacity-50 font-semibold"
                >
                  {isAdminOrComptable ? <Plus size={15} className="mr-1.5" /> : <Lock size={13} className="mr-1.5" />}
                  Émettre une Facture
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-[Georgia] text-2xl text-[#102c26]">
                    Émettre une facture de transit & dédouanement
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#627670]">
                    Générez une facture détaillée avec honoraires HT, TVA 18% et séparation stricte des débours Trésor/PAC.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateInvoice} className="space-y-4 py-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Dossier concerné *</Label>
                      <select
                        value={selectedDossierId || ""}
                        onChange={e => setSelectedDossierId(Number(e.target.value))}
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs"
                        required
                      >
                        <option value="">Sélectionner un dossier...</option>
                        {dossiersQuery.data?.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.dossierNumber} — {d.client} ({d.blLtaNumber || "Sans BL"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Type de facture</Label>
                      <select
                        value={invoiceType}
                        onChange={e => setInvoiceType(e.target.value as any)}
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs"
                      >
                        <option value="Proforma">Facture Proforma (Devis / Provision)</option>
                        <option value="Definitive">Facture Définitive (Après BAE / Livraison)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Devise de facturation</Label>
                      <select
                        value={invoiceCurrency}
                        onChange={e => setInvoiceCurrency(e.target.value)}
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs"
                      >
                        <option value="GNF">GNF (Franc Guinéen)</option>
                        <option value="USD">USD ($ - Dollars US)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Honoraires Transit HT ({invoiceCurrency})</Label>
                      <Input
                        type="number"
                        min="0"
                        value={invoiceAmountHt}
                        onChange={e => setInvoiceAmountHt(Number(e.target.value))}
                        className="h-9 rounded-xl text-xs font-semibold"
                        required
                      />
                    </div>
                  </div>

                  {/* Décomposition des Débours Douaniers & Portuaires */}
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 space-y-2.5">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider block">
                      Débours Douaniers & Portuaires (Non assujettis TVA)
                    </span>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-amber-900 font-medium">Droits de Douane (Trésor)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={invoiceCustomsDuties}
                          onChange={e => setInvoiceCustomsDuties(Number(e.target.value))}
                          className="h-8 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-amber-900 font-medium">Frais Portuaires PAC / Quai</Label>
                        <Input
                          type="number"
                          min="0"
                          value={invoicePortFees}
                          onChange={e => setInvoicePortFees(Number(e.target.value))}
                          className="h-8 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-amber-900 font-medium">Magasinage & Surestaries</Label>
                        <Input
                          type="number"
                          min="0"
                          value={invoiceStorageDemurrage}
                          onChange={e => setInvoiceStorageDemurrage(Number(e.target.value))}
                          className="h-8 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Récapitulatif dynamique des totaux */}
                  <div className="rounded-2xl bg-[#0b3b32] text-white p-3.5 space-y-1 text-xs">
                    <div className="flex justify-between text-emerald-200">
                      <span>Total Prestations HT :</span>
                      <span>{invoiceAmountHt.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                    <div className="flex justify-between text-emerald-200">
                      <span>TVA Légale (18%) :</span>
                      <span>{computedTva.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                    <div className="flex justify-between text-amber-200 font-medium">
                      <span>Total Débours Avancés PAC/Douane :</span>
                      <span>{computedDisbursements.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                    <div className="border-t border-emerald-700/60 pt-1.5 flex justify-between font-bold text-sm text-white">
                      <span>TOTAL GÉNÉRAL :</span>
                      <span>{computedGrandTotal.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Échéance de paiement</Label>
                      <Input
                        type="date"
                        value={invoiceDueDate}
                        onChange={e => setInvoiceDueDate(e.target.value)}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Statut initial</Label>
                      <select
                        value={invoiceStatus}
                        onChange={e => setInvoiceStatus(e.target.value as any)}
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs"
                      >
                        <option value="Proforma">Proforma</option>
                        <option value="Émise">Émise</option>
                        <option value="Payée">Payée</option>
                      </select>
                    </div>
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="submit"
                      disabled={createInvoiceMutation.isPending}
                      className="w-full rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs h-9 font-bold"
                    >
                      {createInvoiceMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                      Générer et Enregistrer la Facture
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Modal Modification Taux de Change avec Dérogation Justifiée & Sync Live */}
        <Dialog open={rateModalOpen} onOpenChange={setRateModalOpen}>
          <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-[Georgia] text-xl text-[#102c26]">
                Paramétrer le Taux GNF / USD & Devises
              </DialogTitle>
              <DialogDescription className="text-xs text-[#627670]">
                Le taux est immuable : chaque facture conserve son taux figé lors de son émission (aucun recalcul rétroactif).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200/60 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-emerald-950">Synchronisation Taux Officiel</p>
                  <p className="text-[11px] text-emerald-800">API Marché / Banque Centrale de Guinée</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => syncRateMutation.mutate()}
                  disabled={syncRateMutation.isPending}
                  className="rounded-xl bg-[#0b3b32] text-white text-xs h-8 px-3 font-semibold shadow-sm gap-1"
                >
                  <RefreshCw size={12} className={syncRateMutation.isPending ? "animate-spin" : ""} />
                  Actualiser Live
                </Button>
              </div>

              <div className="space-y-2.5 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Dérogation Manuelle Exceptionnelle
                </span>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">1 USD ($) =</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1000"
                      max="50000"
                      value={newExchangeRate}
                      onChange={e => setNewExchangeRate(Number(e.target.value))}
                      className="h-10 rounded-xl text-sm font-bold text-emerald-950"
                    />
                    <span className="text-xs font-bold text-[#102c26]">GNF</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">
                    Motif obligatoire de la dérogation *
                  </Label>
                  <Textarea
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Ex: Taux contractuel négocié avec la société minière selon convention cadre."
                    rows={2}
                    className="rounded-xl text-xs border-gray-200 resize-none"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Ce motif sera archivé dans le journal d'audit réglementaire.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setRateModalOpen(false)} className="rounded-xl text-xs">
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (!overrideReason.trim()) {
                    toast.error("Veuillez saisir un motif pour justifier la dérogation manuelle.");
                    return;
                  }
                  overrideRateMutation.mutate({
                    rate: Number(newExchangeRate),
                    sourceCurrency: "USD",
                    overrideReason,
                  });
                }}
                disabled={overrideRateMutation.isPending || !overrideReason.trim()}
                className="rounded-xl bg-[#0b3b32] text-white text-xs h-9 font-bold"
              >
                {overrideRateMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Valider la Dérogation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Rapprochement 3-Voies Dossier ↔ Facture ↔ Paiement */}
        <Dialog open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
          <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-[Georgia] text-xl text-[#102c26]">
                Rapprochement 3-Voies Bancaire
              </DialogTitle>
              <DialogDescription className="text-xs text-[#627670]">
                Validez le rapprochement entre le dossier, la facture #{reconcilingInvoice?.invoiceNumber} et l'extrait bancaire.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="rounded-2xl bg-gray-50 p-3 text-xs space-y-1">
                <p><strong>Client :</strong> {reconcilingInvoice?.client}</p>
                <p><strong>Dossier :</strong> #{reconcilingInvoice?.dossierId}</p>
                <p><strong>Montant Total :</strong> {reconcilingInvoice && formatMoney(reconcilingInvoice.amountTtc + (reconcilingInvoice.disbursementsAmount || 0), reconcilingInvoice.currency)}</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Statut de rapprochement</Label>
                <select
                  value={reconciliationStatus}
                  onChange={e => setReconciliationStatus(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold"
                >
                  <option value="rapproche">✓ Rapprochement Validé (Bancaire Conforme)</option>
                  <option value="partiel">⚠ Rapprochement Partiel (Écart / Acompte)</option>
                  <option value="non_rapproche">✕ Non Rapproché (En attente relevé)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Référence du virement / quittance bancaire *</Label>
                <Input
                  value={reconciliationRef}
                  onChange={e => setReconciliationRef(e.target.value)}
                  placeholder="Ex: VIR-ECOBANK-20260814 ou BCT-991"
                  className="h-10 rounded-xl text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Observations de rapprochement</Label>
                <Textarea
                  value={reconciliationNotes}
                  onChange={e => setReconciliationNotes(e.target.value)}
                  placeholder="Ex: Lettré avec relevé bancaire Vistabank du 18/08."
                  rows={2}
                  className="rounded-xl text-xs border-gray-200 resize-none"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setReconcileModalOpen(false)} className="rounded-xl text-xs">
                Annuler
              </Button>
              <Button
                onClick={handleConfirmReconciliation}
                disabled={reconcileMutation.isPending || !reconciliationRef.trim()}
                className="rounded-xl bg-[#0b3b32] text-white text-xs h-9 font-bold"
              >
                {reconcileMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Enregistrer le Rapprochement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 4 Cartes KPI Principales Dynamiques & Cliquables avec Skeletons Granulaires */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            role="button"
            tabIndex={0}
            onClick={() => setActiveKpiModal("turnover")}
            className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)] cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-emerald-800/40 select-none text-left group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Chiffre d'Affaires Global</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-800 group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                <Wallet size={16} />
              </div>
            </div>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-3 h-8 w-36 rounded-lg" />
            ) : (
              <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
                {formatMoney(data.totalCA_GNF)}
              </p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-emerald-700 font-medium">Facturation transit & dédouanement</span>
              <span className="text-[10px] font-semibold text-emerald-800 opacity-0 group-hover:opacity-100 transition-opacity">
                Détail →
              </span>
            </div>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => setActiveKpiModal("margin")}
            className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)] cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-amber-700/40 select-none text-left group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Marge Brute Estimée</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-800 group-hover:bg-amber-700 group-hover:text-white transition-colors">
                <TrendingUp size={16} />
              </div>
            </div>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-3 h-8 w-32 rounded-lg" />
            ) : (
              <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
                {formatMoney(data.totalMargin_GNF)}
              </p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-amber-800 font-medium">Marge nette opérationnelle IGS</span>
              <span className="text-[10px] font-semibold text-amber-800 opacity-0 group-hover:opacity-100 transition-opacity">
                Détail →
              </span>
            </div>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => setActiveKpiModal("disbursements")}
            className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)] cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-blue-700/40 select-none text-left group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Débours Avancés PAC</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-800 group-hover:bg-blue-700 group-hover:text-white transition-colors">
                <Receipt size={16} />
              </div>
            </div>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-3 h-8 w-36 rounded-lg" />
            ) : (
              <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
                {formatMoney(data.totalDisbursements_GNF)}
              </p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-blue-700 font-medium">Trésor public, PAC & acconage</span>
              <span className="text-[10px] font-semibold text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity">
                Détail →
              </span>
            </div>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => setActiveKpiModal("demurrage_risk")}
            className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)] cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-rose-700/40 select-none text-left group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Risque Surestaries PAC</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-800 group-hover:bg-rose-700 group-hover:text-white transition-colors">
                <AlertTriangle size={16} />
              </div>
            </div>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-3 h-8 w-24 rounded-lg" />
            ) : (
              <p className="mt-3 font-[Georgia] text-2xl font-bold text-rose-700">
                {data.totalDemurrageRisk} <span className="text-sm font-normal text-muted-foreground">dossier(s)</span>
              </p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-rose-700 font-medium">&gt; 7 jours séjour quai Conakry</span>
              <span className="text-[10px] font-semibold text-rose-800 opacity-0 group-hover:opacity-100 transition-opacity">
                Dossiers →
              </span>
            </div>
          </Card>
        </div>

        {/* Navigation par Onglets */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-1 overflow-x-auto">
          {[
            { id: "invoices", label: "Factures & Rapprochement 3-Voies", icon: FileText },
            { id: "profitability", label: "Dashboard Rentabilité & Marges", icon: PieChart },
            { id: "treasury", label: "Trésorerie & Débours PAC", icon: LineChart },
            { id: "rates", label: "Historique Taux de Change", icon: History },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? "bg-[#0b3b32] text-white shadow-sm"
                  : "text-[#536863] hover:bg-emerald-50 hover:text-emerald-950"
              }`}
            >
              <t.icon size={15} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ONGLET 1 : FACTURES & RAPPROCHEMENT 3-VOIES AVEC PAGINATION SERVEUR */}
        {activeTab === "invoices" && (
          <Card className="border-0 bg-white shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">
                  Journal de Facturation & Rapprochement 3-Voies
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suivi du cycle complet : Dossier ↔ Facture ↔ Relevé Bancaire avec quittance officielle.
                </p>
              </div>

              {/* Filtres & Recherche Serveur */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Recherche facture, client..."
                    value={invoiceSearch}
                    onChange={(e) => {
                      setInvoiceSearch(e.target.value);
                      setInvoicePage(1);
                    }}
                    className="h-8 pl-8 text-xs rounded-xl w-48 bg-gray-50 border-gray-200"
                  />
                </div>

                <select
                  value={invoiceStatusFilter}
                  onChange={(e) => {
                    setInvoiceStatusFilter(e.target.value);
                    setInvoicePage(1);
                  }}
                  className="h-8 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-700"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="Proforma">Proforma</option>
                  <option value="Émise">Émise</option>
                  <option value="Payée">Payée</option>
                </select>

                <select
                  value={invoiceReconcileFilter}
                  onChange={(e) => {
                    setInvoiceReconcileFilter(e.target.value);
                    setInvoicePage(1);
                  }}
                  className="h-8 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-700"
                >
                  <option value="all">Tous rapprochements</option>
                  <option value="rapproche">Rapproché</option>
                  <option value="partiel">Partiel</option>
                  <option value="non_rapproche">Non rapproché</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[1100px]">
                <thead className="bg-gray-50/75 text-[#516760] uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="p-3.5 pl-5">N° Facture</th>
                    <th className="p-3.5">Client & Dossier</th>
                    <th className="p-3.5">Honoraires HT</th>
                    <th className="p-3.5">Débours Douane/PAC</th>
                    <th className="p-3.5">Total Général</th>
                    <th className="p-3.5">Marge Nette</th>
                    <th className="p-3.5">Statut Facture</th>
                    <th className="p-3.5">Rapprochement 3-Voies</th>
                    <th className="p-3.5 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoicesPaginatedQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td colSpan={9} className="p-4">
                          <Skeleton className="h-6 w-full rounded-md" />
                        </td>
                      </tr>
                    ))
                  ) : paginatedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        Aucune facture ne correspond à ces critères.
                      </td>
                    </tr>
                  ) : (
                    paginatedInvoices.map(inv => {
                      const isPaid = inv.status === "Payée";
                      const grandTotal = inv.amountTtc + (inv.disbursementsAmount || 0);
                      const isReconciled = inv.reconciliationStatus === "rapproche";

                      return (
                        <tr
                          key={inv.id}
                          onMouseEnter={() => utils.dossier.get.prefetch({ id: inv.dossierId })}
                          onFocus={() => utils.dossier.get.prefetch({ id: inv.dossierId })}
                          className="hover:bg-gray-50/50 transition"
                        >
                          <td className="p-3.5 pl-5">
                            <span className="font-bold text-emerald-950">{inv.invoiceNumber}</span>
                            <span className="block text-[10px] text-muted-foreground font-mono">
                              {inv.invoiceType}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-emerald-950">{inv.client}</div>
                            <div className="text-[10px] text-muted-foreground">Dossier #{inv.dossierId}</div>
                          </td>
                          <td className="p-3.5">{formatMoney(inv.amountHt, inv.currency)}</td>
                          <td className="p-3.5 text-amber-900 font-medium">
                            {formatMoney(inv.disbursementsAmount || 0, inv.currency)}
                          </td>
                          <td className="p-3.5 font-bold text-emerald-950">
                            {formatMoney(grandTotal, inv.currency)}
                          </td>
                          <td className="p-3.5 font-semibold text-emerald-700">
                            +{formatMoney(inv.estimatedMargin || 0, inv.currency)}
                          </td>
                          <td className="p-3.5">
                            <Badge className={isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                              {inv.status}
                            </Badge>
                            {isPaid && inv.receiptNumber && (
                              <span className="block text-[10px] text-emerald-900 font-mono mt-0.5">
                                {inv.receiptNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <button
                              onClick={() => handleOpenReconcile(inv)}
                              className="text-left group/r"
                            >
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold gap-1 cursor-pointer group-hover/r:ring-1 ${
                                  isReconciled
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : inv.reconciliationStatus === "partiel"
                                    ? "bg-amber-50 text-amber-800 border-amber-300"
                                    : "bg-gray-50 text-gray-700 border-gray-300"
                                }`}
                              >
                                {isReconciled ? <CheckCircle2 size={11} /> : <Scale size={11} />}
                                {isReconciled ? "Rapproché" : inv.reconciliationStatus === "partiel" ? "Partiel" : "Non rapproché"}
                              </Badge>
                              {inv.reconciliationRef && (
                                <span className="block text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-[120px]">
                                  {inv.reconciliationRef}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isPaid && (
                                <Button
                                  size="sm"
                                  disabled={!isAdminOrComptable}
                                  title={!isAdminOrComptable ? "Réservé aux administrateurs et comptables" : "Encaisser la facture"}
                                  onClick={() => handleOpenPayment(inv)}
                                  className="h-7 text-[11px] rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 gap-1 px-2.5 shadow-sm disabled:opacity-40"
                                >
                                  {isAdminOrComptable ? <CreditCard size={11} /> : <Lock size={10} />} Encaisser
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrintReceipt(inv)}
                                className="h-7 text-[11px] rounded-lg border-gray-200 hover:bg-emerald-50 text-emerald-950 gap-1 px-2"
                              >
                                <Printer size={11} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Afficher</span>
                <select
                  value={invoiceLimit}
                  onChange={(e) => {
                    setInvoiceLimit(Number(e.target.value));
                    setInvoicePage(1);
                  }}
                  className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>sur un total de <strong>{totalInvoicesCount}</strong> factures</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                  disabled={invoicePage <= 1 || invoicesPaginatedQuery.isLoading}
                  className="h-7 text-xs px-2.5 rounded-lg border-gray-200"
                >
                  <ChevronLeft size={13} className="mr-1" /> Précédent
                </Button>
                <span className="px-3 py-1 font-semibold text-gray-800">
                  Page {invoicePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicePage(p => Math.min(totalPages, p + 1))}
                  disabled={invoicePage >= totalPages || invoicesPaginatedQuery.isLoading}
                  className="h-7 text-xs px-2.5 rounded-lg border-gray-200"
                >
                  Suivant <ChevronRight size={13} className="ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ONGLET 2 : DASHBOARD RENTABILITÉ & MARGES CLIENTS */}
        {activeTab === "profitability" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-0 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold uppercase text-gray-500">Marge Brute Globale</span>
                <p className="mt-2 text-2xl font-bold text-emerald-950">
                  {formatMoney(data.totalMargin_GNF)}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  Taux de marge moyen : <strong>28.4%</strong> sur honoraires
                </p>
              </Card>

              <Card className="border-0 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold uppercase text-gray-500">Total CA Facturé</span>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatMoney(profitability?.totalInvoicedGNF || data.totalCA_GNF)}
                </p>
                <p className="text-[11px] text-gray-600 font-medium mt-1">
                  {profitability?.marginsByClient?.length || 0} clients actifs
                </p>
              </Card>

              <Card className="border-0 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold uppercase text-gray-500">Débours Avancés PAC</span>
                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {formatMoney(profitability?.totalAdvancedDeboursGNF || data.totalDisbursements_GNF)}
                </p>
                <p className="text-[11px] text-amber-800 font-medium mt-1">
                  Dont {formatMoney(profitability?.unrecoveredDeboursGNF || 0)} en attente de remboursement
                </p>
              </Card>
            </div>

            <Card className="border-0 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-[Georgia] text-lg font-bold text-[#102c26]">
                  Rentabilité & Marge Nette par Société Cliente
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Analyse détaillée : (Montant Facturé - Débours PAC Avancés) / Montant Facturé.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-gray-50 text-[#516760] uppercase text-[10px] tracking-wider border-b">
                    <tr>
                      <th className="p-3.5 pl-5">Société Cliente</th>
                      <th className="p-3.5">Dossiers Associés</th>
                      <th className="p-3.5">CA Facturé</th>
                      <th className="p-3.5">Débours PAC Avancés</th>
                      <th className="p-3.5">Marge Brute IGS</th>
                      <th className="p-3.5">Taux de Marge (%)</th>
                      <th className="p-3.5 pr-5">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profitability?.marginsByClient?.map((item: any) => (
                      <tr key={item.client} className="hover:bg-gray-50/50 transition">
                        <td className="p-3.5 pl-5 font-bold text-emerald-950">{item.client}</td>
                        <td className="p-3.5 text-gray-600">{item.dossiersCount} dossier(s)</td>
                        <td className="p-3.5 font-semibold text-gray-900">{formatMoney(item.invoicedAmountGNF)}</td>
                        <td className="p-3.5 text-amber-900 font-medium">{formatMoney(item.disbursementsGNF)}</td>
                        <td className="p-3.5 font-bold text-emerald-800">+{formatMoney(item.marginGNF)}</td>
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-950">{item.marginRatePct}%</span>
                        </td>
                        <td className="p-3.5 pr-5">
                          <Badge
                            className={
                              item.marginRatePct >= 25
                                ? "bg-emerald-100 text-emerald-900"
                                : item.marginRatePct >= 15
                                ? "bg-amber-100 text-amber-900"
                                : "bg-rose-100 text-rose-900"
                            }
                          >
                            {item.marginRatePct >= 25 ? "Excellente" : item.marginRatePct >= 15 ? "Standard" : "Faible marge"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ONGLET 3 : TRÉSORERIE & DÉBOURS PAC */}
        {activeTab === "treasury" && (
          <div className="space-y-6">
            <Card className="border-0 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-[Georgia] text-lg font-bold text-[#102c26]">
                      Indicateur de Risque Débours PAC / CA Facturé
                    </h3>
                    <Badge
                      className={
                        profitability?.isRiskAlert
                          ? "bg-rose-100 text-rose-900 border-rose-300 font-bold"
                          : "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold"
                      }
                    >
                      Ratio : {profitability?.deboursToCARatioPct || 0}% {profitability?.isRiskAlert ? "— CRITIQUE (>150%)" : "— SAIN"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seuil d'alerte configuré à 150%. Un ratio élevé indique une avance de trésorerie disproportionnée au Port de Conakry.
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Débours non recouvrés :</span>
                  <p className="text-xl font-bold text-rose-700">
                    {formatMoney(profitability?.unrecoveredDeboursGNF || 0)}
                  </p>
                </div>
              </div>

              <div className="mt-4 w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (profitability?.deboursToCARatioPct || 0) > 150
                      ? "bg-rose-600"
                      : (profitability?.deboursToCARatioPct || 0) > 100
                      ? "bg-amber-500"
                      : "bg-emerald-600"
                  }`}
                  style={{ width: `${Math.min(100, ((profitability?.deboursToCARatioPct || 0) / 200) * 100)}%` }}
                />
              </div>
            </Card>

            <Card className="border-0 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-[Georgia] text-lg font-bold text-[#102c26]">
                  Évolution Mensuelle : Facturation vs Encaissements vs Débours PAC
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Flux comparatif en GNF sur l'ensemble de la période d'activité.
                </p>
              </div>

              <div className="h-72 w-full">
                {treasuryFlowQuery.isLoading ? (
                  <Skeleton className="h-full w-full rounded-2xl" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={treasuryFlowQuery.data || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${Math.round(val / 1000000)}M`} />
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toLocaleString("fr-FR")} GNF`, ""]}
                        contentStyle={{ borderRadius: "12px", fontSize: "11px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Bar dataKey="facture" name="CA Facturé" fill="#0b3b32" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="encaisse" name="CA Encaissé" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="deboursAvances" name="Débours Avancés PAC" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ONGLET 4 : HISTORIQUE IMMUABLE TAUX DE CHANGE */}
        {activeTab === "rates" && (
          <Card className="border-0 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-[Georgia] text-lg font-bold text-[#102c26]">
                  Historique Immuable des Taux de Change GNF / USD / EUR
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Traçabilité réglementaire complète : chaque facture conserve son taux figé lors de son émission.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => syncRateMutation.mutate()}
                disabled={syncRateMutation.isPending}
                className="rounded-xl bg-[#0b3b32] text-white text-xs h-8 px-3 font-semibold shadow-sm gap-1"
              >
                <RefreshCw size={12} className={syncRateMutation.isPending ? "animate-spin" : ""} />
                Synchroniser Live
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead className="bg-gray-50 text-[#516760] uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="p-3.5 pl-5">Date d'Application</th>
                    <th className="p-3.5">Paire de Devises</th>
                    <th className="p-3.5">Taux de Change</th>
                    <th className="p-3.5">Source / Fournisseur</th>
                    <th className="p-3.5">Type de Taux</th>
                    <th className="p-3.5 pr-5">Motif de Dérogation (si manuel)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ratesHistoryQuery.isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td colSpan={6} className="p-4">
                          <Skeleton className="h-6 w-full rounded-md" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    ratesHistoryQuery.data?.map((rate) => (
                      <tr key={rate.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-3.5 pl-5 font-bold text-gray-900">{rate.date}</td>
                        <td className="p-3.5 font-mono text-emerald-900 font-semibold">{rate.sourceCurrency} / {rate.targetCurrency}</td>
                        <td className="p-3.5 font-bold text-emerald-950 text-sm">
                          1 {rate.sourceCurrency} = {rate.rate.toLocaleString("fr-FR")} GNF
                        </td>
                        <td className="p-3.5 text-gray-700">{rate.provider}</td>
                        <td className="p-3.5">
                          <Badge className={rate.isManualOverride ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}>
                            {rate.isManualOverride ? "Dérogation Manuelle" : "Officiel Automatique"}
                          </Badge>
                        </td>
                        <td className="p-3.5 pr-5 text-gray-600 italic">
                          {rate.overrideReason || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Modal de Détail KPI */}
        <KpiDetailModal
          kpiType={activeKpiModal}
          isOpen={activeKpiModal !== null}
          onClose={() => setActiveKpiModal(null)}
          invoices={data.invoices || []}
          dossiers={dossiersQuery.data || []}
          displayCurrency={displayCurrency}
          exchangeRate={activeRate}
          isLoading={summaryQuery.isLoading || dossiersQuery.isLoading}
        />
      </div>
    </DashboardLayout>
  );
}
