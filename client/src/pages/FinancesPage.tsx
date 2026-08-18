import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Download,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function FinancesPage() {
  const summaryQuery = trpc.finance.summary.useQuery();
  const invoicesQuery = trpc.finance.listInvoices.useQuery();
  const dossiersQuery = trpc.dossier.list.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDossierId, setSelectedDossierId] = useState<number | undefined>();
  const [invoiceCurrency, setInvoiceCurrency] = useState("GNF");
  const [invoiceAmountHt, setInvoiceAmountHt] = useState(25000000);
  const [invoiceDisbursements, setInvoiceDisbursements] = useState(60000000);
  const [invoiceStatus, setInvoiceStatus] = useState<any>("Émise");

  const [displayCurrency, setDisplayCurrency] = useState<"GNF" | "USD">("GNF");
  const USD_RATE = 8650; // 1 USD = 8,650 GNF

  const createInvoiceMutation = trpc.finance.createInvoice.useMutation({
    onSuccess: () => {
      toast.success("Facture créée avec succès");
      setCreateOpen(false);
      invoicesQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const data = summaryQuery.data || {
    totalCA_GNF: 0,
    totalCA_USD: 0,
    totalMargin_GNF: 0,
    pendingInvoices: 0,
    totalDemurrageRisk: 0,
    invoices: [],
  };

  const formatMoney = (amountGnf: number, originalCurrency: string = "GNF") => {
    if (displayCurrency === "USD") {
      const inUsd = originalCurrency === "USD" ? amountGnf : amountGnf / USD_RATE;
      return `$ ${inUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    } else {
      const inGnf = originalCurrency === "USD" ? amountGnf * USD_RATE : amountGnf;
      return `${Math.round(inGnf).toLocaleString("fr-FR")} GNF`;
    }
  };

  const handleCreate = () => {
    if (!selectedDossierId) {
      toast.error("Veuillez sélectionner un dossier");
      return;
    }
    const d = dossiersQuery.data?.find(item => item.id === selectedDossierId);
    createInvoiceMutation.mutate({
      dossierId: selectedDossierId,
      client: d?.client || "Client IGS",
      currency: invoiceCurrency,
      amountHt: invoiceAmountHt,
      amountTva: invoiceAmountHt * 0.18,
      amountTtc: invoiceAmountHt * 1.18,
      disbursementsAmount: invoiceDisbursements,
      status: invoiceStatus,
    });
  };

  const printInvoiceReceipt = (inv: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour imprimer la facture.");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Facture / Quittance - ${inv.invoiceNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1a2e29; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0b3b32; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #0b3b32; }
          .subtitle { font-size: 12px; color: #52736b; }
          .client-box { margin-top: 30px; padding: 15px; background: #f5f8f7; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th { background: #0b3b32; color: white; padding: 10px; text-align: left; font-size: 12px; }
          td { padding: 12px 10px; border-bottom: 1px solid #e1ebe7; font-size: 13px; }
          .total-box { margin-top: 30px; text-align: right; }
          .total-row { font-size: 18px; font-weight: bold; color: #0b3b32; margin-top: 10px; }
          .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #819b93; border-top: 1px solid #e1ebe7; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">IBRAHIMA GOLD SERVICE (IGS)</div>
            <div class="subtitle">Transit Maritime, Dédouanement & Logistique Portuaire PAC</div>
            <div class="subtitle">Conakry, République de Guinée • RCCM/GC-KAL/012.345A/2020</div>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; color: #0b3b32;">${inv.status === "Payée" ? "QUITTANCE DE PAIEMENT" : "FACTURE PROFORMA"}</h2>
            <div style="font-weight: bold; margin-top: 5px;">N° ${inv.invoiceNumber}</div>
            <div style="font-size: 12px; color: #666;">Date: ${new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        </div>

        <div class="client-box">
          <strong>DESTINATAIRE / CLIENT :</strong><br/>
          <span style="font-size: 15px; font-weight: bold; color: #0b3b32;">${inv.client}</span><br/>
          <span>Dossier de transit : Dossier #${inv.dossierId}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>DÉSIGNATION DES PRESTATIONS & DÉBOURS</th>
              <th style="text-align: right;">MONTANT (${inv.currency})</th>
              <th style="text-align: right;">ÉQUIVALENT USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Honoraires & Prestations de Transit / Dédouanement Portuaire</td>
              <td style="text-align: right;">${inv.amountHt.toLocaleString()} ${inv.currency}</td>
              <td style="text-align: right;">$ ${(inv.amountHt / USD_RATE).toFixed(2)}</td>
            </tr>
            <tr>
              <td>TVA Réglée (18%)</td>
              <td style="text-align: right;">${inv.amountTva.toLocaleString()} ${inv.currency}</td>
              <td style="text-align: right;">$ ${(inv.amountTva / USD_RATE).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Débours Douaniers (Droits Trésor Public, PAC, Conakry Terminal)</td>
              <td style="text-align: right;">${(inv.disbursementsAmount || 0).toLocaleString()} ${inv.currency}</td>
              <td style="text-align: right;">$ ${((inv.disbursementsAmount || 0) / USD_RATE).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-box">
          <div>Total Prestations HT : <strong>${inv.amountHt.toLocaleString()} ${inv.currency}</strong></div>
          <div>Total Débours Douane : <strong>${(inv.disbursementsAmount || 0).toLocaleString()} ${inv.currency}</strong></div>
          <div class="total-row">TOTAL GÉNÉRAL À RECOUVRER : ${(inv.amountTtc + (inv.disbursementsAmount || 0)).toLocaleString()} ${inv.currency}</div>
          <div style="color: #666; font-size: 12px; margin-top: 4px;">Équivalent Devises : $ ${((inv.amountTtc + (inv.disbursementsAmount || 0)) / USD_RATE).toFixed(2)} USD (Taux: 1 USD = 8 650 GNF)</div>
          <div style="margin-top: 8px;"><span style="display: inline-block; padding: 4px 10px; background: ${inv.status === 'Payée' ? '#d1fae5' : '#fef3c7'}; color: ${inv.status === 'Payée' ? '#065f46' : '#92400e'}; border-radius: 4px; font-weight: bold;">STATUT : ${inv.status.toUpperCase()}</span></div>
        </div>

        <div class="footer">
          Ibrahima Gold Service S.A.R.L - Port Autonome de Conakry, République de Guinée.<br/>
          Pour toute question comptable : finance@igs-logistics.gn | +224 620 00 00 00
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* En-tête Finances avec Sélecteur Multi-Devises */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[Georgia] text-2xl sm:text-3xl font-bold tracking-tight text-[#102c26]">
              Finances, Facturation & Débours
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#627670]">
              Pilotage financier de Fatoumata Camara : Facturation proforma/définitive, taxes douanières, droits PAC et double affichage GNF/USD.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs h-9">
                  <Plus size={15} className="mr-1.5" /> Émettre une Facture
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Émettre une facture de dédouanement & transit</DialogTitle>
                  <DialogDescription>Générez la facture pour un dossier actif.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Dossier concerné</Label>
                    <select
                      value={selectedDossierId || ""}
                      onChange={e => setSelectedDossierId(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-gray-200 px-3 text-xs bg-white"
                    >
                      <option value="">Sélectionner un dossier...</option>
                      {dossiersQuery.data?.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.dossierNumber} - {d.client} ({d.blLtaNumber})
                        </option>
                      ))}
                    </select>
                  </div>

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
                      <Label className="text-xs">Montant Prestation HT</Label>
                      <Input type="number" value={invoiceAmountHt} onChange={e => setInvoiceAmountHt(Number(e.target.value))} className="h-9 text-xs rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Débours estimés (Droits Douane + PAC)</Label>
                    <Input type="number" value={invoiceDisbursements} onChange={e => setInvoiceDisbursements(Number(e.target.value))} className="h-9 text-xs rounded-xl" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} className="rounded-xl bg-[#0b3b32] text-white">Générer la facture</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cartes KPI Financiers */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">CA Global</span>
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
            <p className="mt-1 text-[11px] text-amber-800 font-medium">~25% marge nette moyenne</p>
          </Card>

          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Factures en Attente</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-800">
                <Receipt size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
              {data.pendingInvoices} <span className="text-sm font-normal text-muted-foreground">facture(s)</span>
            </p>
            <p className="mt-1 text-[11px] text-blue-700 font-medium">Proforma ou à encaisser</p>
          </Card>

          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">Risques Surestaries PAC</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-800">
                <AlertTriangle size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-rose-700">
              {data.totalDemurrageRisk} <span className="text-sm font-normal text-muted-foreground">dossiers</span>
            </p>
            <p className="mt-1 text-[11px] text-rose-700 font-medium">&gt;7 jours de séjour quai PAC</p>
          </Card>
        </div>

        {/* Tableau des Factures & Quittances */}
        <Card className="border-0 bg-white shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">Factures Récentes, Débours & Quittances</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Édition, suivi des débours douaniers et téléchargement direct pour vos clients.</p>
            </div>
            <Badge variant="outline" className="border-emerald-800 text-emerald-900 text-xs">
              {invoicesQuery.data?.length || 0} factures
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 text-[#516760] uppercase text-[10px] tracking-wider border-b">
                <tr>
                  <th className="p-3.5 pl-5">N° Facture</th>
                  <th className="p-3.5">Client & Dossier</th>
                  <th className="p-3.5">Prestations HT</th>
                  <th className="p-3.5">Débours Douane</th>
                  <th className="p-3.5">Total TTC</th>
                  <th className="p-3.5">Marge Estimée</th>
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
                  invoicesQuery.data?.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-3.5 pl-5 font-bold text-emerald-950">{inv.invoiceNumber}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-emerald-950">{inv.client}</div>
                        <div className="text-[10px] text-muted-foreground">Dossier #{inv.dossierId}</div>
                      </td>
                      <td className="p-3.5">{formatMoney(inv.amountHt, inv.currency)}</td>
                      <td className="p-3.5 text-amber-900 font-medium">{formatMoney(inv.disbursementsAmount || 0, inv.currency)}</td>
                      <td className="p-3.5 font-bold text-emerald-950">{formatMoney(inv.amountTtc, inv.currency)}</td>
                      <td className="p-3.5 font-semibold text-emerald-700">+{formatMoney(inv.estimatedMargin, inv.currency)}</td>
                      <td className="p-3.5">
                        <Badge className={inv.status === "Payée" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printInvoiceReceipt(inv)}
                          className="h-7 text-[11px] rounded-lg border-gray-200 text-emerald-900 hover:bg-emerald-50 gap-1"
                        >
                          <Download size={12} /> {inv.status === "Payée" ? "Quittance" : "Proforma"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
