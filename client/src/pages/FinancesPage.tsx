import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  Edit,
  FileCheck,
  FileText,
  Loader2,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function FinancesPage() {
  const utils = trpc.useUtils();
  const summaryQuery = trpc.finance.summary.useQuery();
  const invoicesQuery = trpc.finance.listInvoices.useQuery();
  const dossiersQuery = trpc.dossier.list.useQuery();

  // Multi-Currency Switcher State
  const [displayCurrency, setDisplayCurrency] = useState<"GNF" | "USD">("GNF");

  // Exchange Rate Modal State
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [newExchangeRate, setNewExchangeRate] = useState(8650);

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

  const activeRate = summaryQuery.data?.exchangeRate || 8650;

  // Mutations
  const setExchangeRateMutation = trpc.finance.setExchangeRate.useMutation({
    onSuccess: (res) => {
      toast.success(`Taux de change mis à jour : 1 USD = ${res.rate.toLocaleString("fr-FR")} GNF`);
      setRateModalOpen(false);
      summaryQuery.refetch();
      invoicesQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Erreur mise à jour taux : ${err.message}`);
    },
  });

  const createInvoiceMutation = trpc.finance.createInvoice.useMutation({
    onSuccess: (created) => {
      toast.success(`Facture ${created.invoiceNumber} générée avec succès !`);
      setCreateOpen(false);
      invoicesQuery.refetch();
      summaryQuery.refetch();
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
      invoicesQuery.refetch();
      summaryQuery.refetch();
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
  const computedTotalDisbursements = Number(invoiceCustomsDuties || 0) + Number(invoicePortFees || 0) + Number(invoiceStorageDemurrage || 0);
  const computedAmountTtc = Number(invoiceAmountHt || 0) + computedTva;
  const computedGrandTotal = computedAmountTtc + computedTotalDisbursements;

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDossierId) {
      toast.error("Veuillez sélectionner un dossier.");
      return;
    }
    const d = dossiersQuery.data?.find(item => item.id === selectedDossierId);
    createInvoiceMutation.mutate({
      dossierId: selectedDossierId,
      client: d?.client || "Client IGS",
      currency: invoiceCurrency,
      invoiceType,
      exchangeRate: activeRate,
      amountHt: invoiceAmountHt,
      amountTva: computedTva,
      amountTtc: computedAmountTtc,
      disbursementsAmount: computedTotalDisbursements,
      customsDutiesAmount: Number(invoiceCustomsDuties || 0),
      portFeesAmount: Number(invoicePortFees || 0),
      storageAndDemurrageFees: Number(invoiceStorageDemurrage || 0),
      status: invoiceStatus,
      dueDate: invoiceDueDate ? new Date(`${invoiceDueDate}T00:00:00Z`) : null,
      notes: invoiceNotes.trim() || null,
    });
  };

  const handleOpenPayment = (inv: any) => {
    setPayingInvoice(inv);
    setPaymentReference(`VIR-ECOBANK-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaidAmount(inv.amountTtc + (inv.disbursementsAmount || 0));
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    recordPaymentMutation.mutate({
      id: payingInvoice.id,
      paymentMethod,
      paymentReference,
      paidAmount: paidAmount || (payingInvoice.amountTtc + (payingInvoice.disbursementsAmount || 0)),
    });
  };

  const printInvoiceReceipt = (inv: any) => {
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
                  <span style="font-size: 10px; color: #666;">Frais de séjour conteneurs quai PAC</span>
                </td>
                <td class="text-right font-bold text-amber-900">${inv.storageAndDemurrageFees.toLocaleString("fr-FR")} ${inv.currency}</td>
                <td class="text-right">$ ${(inv.storageAndDemurrageFees / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
              </tr>
            ` : ""}
            ${!inv.customsDutiesAmount && !inv.portFeesAmount && totalDisb ? `
              <tr>
                <td><strong>Débours Douaniers & Portuaires Globaux</strong></td>
                <td class="text-right font-bold text-amber-900">${totalDisb.toLocaleString("fr-FR")} ${inv.currency}</td>
                <td class="text-right">$ ${(totalDisb / (inv.exchangeRate || activeRate)).toFixed(2)}</td>
              </tr>
            ` : ""}
          </tbody>
        </table>

        <div class="total-box">
          <div style="font-size: 12px;">Total Prestations TTC : <strong>${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency}</strong></div>
          <div style="font-size: 12px;">Total Débours Douaniers & Port : <strong>${totalDisb.toLocaleString("fr-FR")} ${inv.currency}</strong></div>
          <div class="total-row">TOTAL GÉNÉRAL : ${grandTotal.toLocaleString("fr-FR")} ${inv.currency}</div>
          <div style="color: #555; font-size: 11px; margin-top: 3px;">
            Contrevaleur Devises : <strong>$ ${usdEquiv} USD</strong> (Taux appliqué : 1 USD = ${(inv.exchangeRate || activeRate).toLocaleString("fr-FR")} GNF)
          </div>
          <div><span class="receipt-tag">STATUT : ${inv.status.toUpperCase()} ${isPaid && inv.paymentMethod ? `(${inv.paymentMethod})` : ""}</span></div>
        </div>

        <div class="footer">
          Ibrahima Gold Service S.A.R.L • Port Autonome de Conakry, République de Guinée.<br/>
          Comptabilité & Règlements : finance@igs-logistics.gn • Téléphone : +224 620 00 00 00 / +224 664 00 00 00
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  const isAnyLoading = summaryQuery.isLoading || invoicesQuery.isLoading;
  const isAnyError = summaryQuery.isError || invoicesQuery.isError;
  const firstError = summaryQuery.error || invoicesQuery.error;

  if (isAnyLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 pb-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-8 w-72 rounded-xl" />
              <Skeleton className="h-4 w-96 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-36 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (isAnyError) {
    console.error("[FinancesPage] Erreur de chargement des données financières:", firstError);
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl py-12 text-center">
          <div className="rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-[Georgia] text-xl font-bold text-[#1b2f29]">
              Impossible de charger le module financier
            </h2>
            <p className="mt-2 text-xs text-[#667772]">
              Une erreur est survenue lors de la récupération des factures et du journal de caisse.
            </p>
            {firstError?.message && (
              <p className="mt-3 font-mono text-[11px] text-red-700 bg-red-50 p-2 rounded-xl">
                {firstError.message}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  summaryQuery.refetch();
                  invoicesQuery.refetch();
                }}
                className="rounded-xl border-[#dfe8e4] text-[#2b4c42] hover:bg-[#edf5f1] text-xs"
              >
                <RotateCcw size={14} className="mr-1.5" /> Réessayer
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

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
              Émission de factures proforma/définitives, décomposition des débours douaniers/PAC, encaissements et conversion GNF/USD.
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
                <Button className="h-9 rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs shadow-sm">
                  <Plus size={15} className="mr-1.5" /> Émettre une Facture
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
                      <span>TVA (18%) :</span>
                      <span>{computedTva.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                    <div className="flex justify-between text-amber-300">
                      <span>Total Débours Douane & PAC :</span>
                      <span>{computedTotalDisbursements.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/20 pt-1.5 font-bold text-sm">
                      <span>TOTAL GÉNÉRAL À RECOUVRER :</span>
                      <span className="text-[#d9a94b]">{computedGrandTotal.toLocaleString("fr-FR")} {invoiceCurrency}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#3a504a]">Date d'échéance</Label>
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
                      className="w-full rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs h-9"
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

        {/* Modal Modification du Taux de Change GNF / USD */}
        <Dialog open={rateModalOpen} onOpenChange={setRateModalOpen}>
          <DialogContent className="max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-[Georgia] text-xl text-[#102c26]">
                Paramétrer le Taux GNF / USD
              </DialogTitle>
              <DialogDescription className="text-xs text-[#627670]">
                Fixez le taux de change officiel appliqué aux factures et aux conversions automatiques.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#3a504a]">1 USD ($) =</Label>
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
            </div>
            <DialogFooter>
              <Button
                onClick={() => setExchangeRateMutation.mutate({ rate: Number(newExchangeRate) })}
                disabled={setExchangeRateMutation.isPending}
                className="w-full rounded-xl bg-[#0b3b32] text-white text-xs h-9"
              >
                {setExchangeRateMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Mettre à jour le taux
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cartes KPI Financiers Dynamiques (GNF / USD) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Chiffre d'Affaires Global</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                <Wallet size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
              {formatMoney(data.totalCA_GNF)}
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 font-medium">Facturation transit & dédouanement</p>
          </Card>

          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Marge Brute Estimée</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-800">
                <TrendingUp size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
              {formatMoney(data.totalMargin_GNF)}
            </p>
            <p className="mt-1 text-[11px] text-amber-800 font-medium">Marge nette opérationnelle IGS</p>
          </Card>

          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Débours Avancés PAC</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-800">
                <Receipt size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
              {formatMoney(data.totalDisbursements_GNF)}
            </p>
            <p className="mt-1 text-[11px] text-blue-700 font-medium">Trésor public, PAC & acconage</p>
          </Card>

          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Risque Surestaries PAC</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-800">
                <AlertTriangle size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-rose-700">
              {data.totalDemurrageRisk} <span className="text-sm font-normal text-muted-foreground">dossier(s)</span>
            </p>
            <p className="mt-1 text-[11px] text-rose-700 font-medium">&gt; 7 jours séjour quai Conakry</p>
          </Card>
        </div>

        {/* Tableau des Factures, Débours & Quittances */}
        <Card className="border-0 bg-white shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">
                Factures Récentes, Débours & Quittances de Paiement
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suivi des encaissements, décomposition des taxes douanières et impression de quittances officielles.
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-800 text-emerald-900 text-xs">
              {invoicesQuery.data?.length || 0} facture(s)
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-gray-50/75 text-[#516760] uppercase text-[10px] tracking-wider border-b">
                <tr>
                  <th className="p-3.5 pl-5">N° Facture</th>
                  <th className="p-3.5">Client & Dossier</th>
                  <th className="p-3.5">Honoraires HT</th>
                  <th className="p-3.5">Débours Douane/PAC</th>
                  <th className="p-3.5">Total Général</th>
                  <th className="p-3.5">Marge Nette</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoicesQuery.data?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Aucune facture enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  invoicesQuery.data?.map(inv => {
                    const isPaid = inv.status === "Payée";
                    const grandTotal = inv.amountTtc + (inv.disbursementsAmount || 0);

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
                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenPayment(inv)}
                                className="h-7 text-[11px] rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 gap-1 px-2.5 shadow-sm"
                              >
                                <CreditCard size={11} /> Encaisser
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  toast.info("Génération de la facture officielle PDF...");
                                  const { generateInvoicePdf } = await import("@/lib/pdfGenerator");
                                  await generateInvoicePdf({
                                    invoiceNumber: inv.invoiceNumber,
                                    type: inv.invoiceType || "Definitive",
                                    status: inv.status,
                                    dossierNumber: `DOS-${String(inv.dossierId).padStart(4, "0")}`,
                                    client: inv.client,
                                    amountTtc: inv.amountTtc + (inv.disbursementsAmount || 0),
                                    currency: inv.currency,
                                    estimatedMargin: inv.estimatedMargin,
                                    createdAt: inv.createdAt,
                                    dueDate: inv.dueDate,
                                    portalAccessCode: `IGS-${1000 + inv.dossierId}`,
                                  });
                                  toast.success(`Facture ${inv.invoiceNumber} téléchargée en PDF.`);
                                } catch (e) {
                                  toast.error("Erreur lors de la génération du PDF");
                                }
                              }}
                              className="h-7 text-[11px] rounded-lg border-emerald-800/40 text-emerald-950 hover:bg-emerald-50 gap-1 px-2.5 font-semibold"
                            >
                              <FileText size={11} className="text-emerald-700" /> PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => printInvoiceReceipt(inv)}
                              className="h-7 text-[11px] rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100 gap-1 px-2"
                              title="Imprimer ticket thermique ou standard"
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
        </Card>

        {/* Modal Enregistrement de Paiement & Quittance */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-[Georgia] text-xl text-[#102c26]">
                Enregistrer le Paiement & Émettre la Quittance
              </DialogTitle>
              <DialogDescription className="text-xs text-[#627670]">
                Facture {payingInvoice?.invoiceNumber} — Client : <strong>{payingInvoice?.client}</strong>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmPayment} className="space-y-3.5 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#3a504a]">Mode de règlement</Label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs"
                >
                  <option value="Virement bancaire Ecobank / Vistabank">Virement bancaire (Ecobank / Vistabank)</option>
                  <option value="Chèque certifié">Chèque certifié</option>
                  <option value="Espèces (Caisse IGS Conakry)">Espèces (Caisse IGS Conakry)</option>
                  <option value="Orange Money / Mobile Money">Orange Money / Mobile Money</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#3a504a]">Référence de la transaction / Numéro de chèque</Label>
                <Input
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="ex: VIR-2026-088147"
                  className="h-9 rounded-xl text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#3a504a]">Montant encaissé ({payingInvoice?.currency || "GNF"})</Label>
                <Input
                  type="number"
                  value={paidAmount || 0}
                  onChange={e => setPaidAmount(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs font-bold text-emerald-950"
                  required
                />
              </div>

              <div className="rounded-xl bg-emerald-50/70 p-3 text-xs text-emerald-950 space-y-1">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  Génération automatique du reçu officiel :
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Un numéro de quittance séquentiel officiel (REC-2026-X) sera généré et joint à ce dossier.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="w-full rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs h-9"
                >
                  {recordPaymentMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Valider le Paiement & Émettre la Quittance
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
