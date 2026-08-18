import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
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

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* En-tête Finances */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[Georgia] text-2xl sm:text-3xl font-bold tracking-tight text-[#102c26]">
              Finances, Facturation & Surestaries
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#627670]">
              Suivi du Chiffre d'Affaires (GNF & USD), calcul de marge par dossier et prévention des surestaries PAC.
            </p>
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

        {/* Cartes KPI Financiers */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 bg-white p-5 shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#637972]">CA Global (GNF)</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                <Wallet size={16} />
              </div>
            </div>
            <p className="mt-3 font-[Georgia] text-2xl font-bold text-[#102c26]">
              {data.totalCA_GNF.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">GNF</span>
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
              {data.totalMargin_GNF.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">GNF</span>
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

        {/* Tableau des Factures */}
        <Card className="border-0 bg-white shadow-[0_8px_24px_rgba(20,50,43,0.05)]">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-[Georgia] text-lg font-semibold text-[#102c26]">Factures Récentes & Débours</h2>
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
                  <th className="p-3.5">Montant HT</th>
                  <th className="p-3.5">Total TTC</th>
                  <th className="p-3.5">Marge Estimée</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 pr-5 text-right">Date d'Émission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoicesQuery.data?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
                      <td className="p-3.5">{inv.amountHt.toLocaleString()} {inv.currency}</td>
                      <td className="p-3.5 font-bold text-emerald-950">{inv.amountTtc.toLocaleString()} {inv.currency}</td>
                      <td className="p-3.5 font-semibold text-emerald-700">+{inv.estimatedMargin.toLocaleString()} {inv.currency}</td>
                      <td className="p-3.5">
                        <Badge className={inv.status === "Payée" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 pr-5 text-right text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
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
