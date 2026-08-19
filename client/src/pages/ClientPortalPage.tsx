import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Globe,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  Ship,
} from "lucide-react";
import { useState } from "react";

const IGS_LOGO = "/igs-logo-transparent.png";

export default function ClientPortalPage() {
  const [searchCode, setSearchCode] = useState("IGS-1001");
  const [submittedCode, setSubmittedCode] = useState("IGS-1001");

  const portalQuery = trpc.portal.track.useQuery(
    { accessCodeOrNumber: submittedCode },
    { enabled: Boolean(submittedCode.trim()) }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      setSubmittedCode(searchCode.trim());
    }
  };

  const data = portalQuery.data;
  const dossier = data?.dossier;

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-[#102c26]">
      {/* Header Public Portail */}
      <header className="border-b border-[#e2eae6] bg-white px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 flex items-center">
              <img src={IGS_LOGO} alt="IGS — Ibrahima Gold Service" className="h-full w-auto object-contain" />
            </div>
            <div>
              <span className="font-bold text-sm text-[#0b3b32] block">Portail Suivi Client & Dédouanement</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Ibrahima Gold Service Guinée</p>
            </div>
          </div>
          <a
            href="/"
            className="rounded-xl border border-[#dfe9e4] bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-gray-100"
          >
            Accès Espace Agent IGS ➔
          </a>
        </div>
      </header>

      {/* Barre de Recherche de Suivi */}
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-[Georgia] text-2xl sm:text-3xl font-bold text-[#0b3b32]">
            Suivi en temps réel de votre marchandise
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
            Consultez le statut de dédouanement à Conakry, les dates d'arrivée, les documents officiels et l'état de régularisation sans attente téléphonique.
          </p>

          <form onSubmit={handleSearch} className="mt-4 flex max-w-md mx-auto gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={searchCode}
                onChange={e => setSearchCode(e.target.value)}
                placeholder="Entrez votre N° de BL ou Code (ex: IGS-1001, HLCUNG...)"
                className="pl-9 h-11 rounded-2xl border-emerald-950/20 bg-white text-xs"
              />
            </div>
            <Button type="submit" className="h-11 rounded-2xl bg-[#0b3b32] text-white hover:bg-[#164d41] px-5 text-xs">
              {portalQuery.isLoading ? <Loader2 size={15} className="animate-spin" /> : "Consulter"}
            </Button>
          </form>
        </div>

        {/* Résultat du Suivi */}
        {portalQuery.isLoading && (
          <div className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-800" />
            <p className="text-xs text-muted-foreground mt-2">Recherche des informations maritimes et douanières...</p>
          </div>
        )}

        {portalQuery.isError && (
          <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
            <p className="font-semibold text-xs text-rose-800">{portalQuery.error.message}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Exemples valides : IGS-1001, CKYSI26000340, HLCUNG12604AUQG1</p>
          </Card>
        )}

        {dossier && (
          <div className="space-y-6">
            {/* Carte Récapitulative */}
            <Card className="border-0 bg-white p-6 shadow-[0_12px_36px_rgba(20,50,43,0.06)] rounded-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-emerald-950">{dossier.dossierNumber}</span>
                    <Badge className={dossier.calculatedStatus === "Régularisé" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                      {dossier.calculatedStatus === "Régularisé" ? <CheckCircle2 size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
                      {dossier.calculatedStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Client : <strong>{dossier.client}</strong> • N° Client : <strong>{dossier.clientDossierNumber}</strong></p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-muted-foreground">Code Portail Partagé :</span>
                  <p className="font-mono font-bold text-sm text-emerald-900">{dossier.portalAccessCode || submittedCode}</p>
                </div>
              </div>

              {/* Indicateur de Progression Visuelle (Timeline 5 Étapes) */}
              <div className="py-6 border-b">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-[Georgia] text-sm font-bold text-emerald-950">Progression Globale du Transit & Dédouanement</h3>
                  <Badge className="bg-[#0b3b32] text-white text-xs">
                    {dossier.goodsReleaseDate ? "100% — Marchandise Livrée" : dossier.declarationNumber ? "75% — En cours de dédouanement" : dossier.eta && new Date(dossier.eta) < new Date() ? "40% — Au quai PAC" : "20% — En acheminement"}
                  </Badge>
                </div>

                {(() => {
                  const now = new Date();
                  const etaDate = dossier.eta ? new Date(dossier.eta) : null;
                  const isArrived = Boolean(etaDate && etaDate < now) || Boolean(dossier.goodsReleaseDate);
                  const isCustomsCleared = Boolean(dossier.declarationNumber && dossier.bulletinNumber);
                  const isBaeGranted = dossier.baeStatus === "Accordé" || dossier.badStatus === "Obtenu";
                  const isDelivered = Boolean(dossier.goodsReleaseDate);

                  const steps = [
                    { id: 1, title: "1. En transit", desc: `${dossier.originPort || "POL"} ➔ Conakry`, done: true, current: !isArrived },
                    { id: 2, title: "2. Arrivée PAC", desc: dossier.eta ? `ETA: ${new Date(dossier.eta).toLocaleDateString("fr-FR")}` : "Planification", done: isArrived, current: isArrived && !isCustomsCleared },
                    { id: 3, title: "3. SYDONIA & DDI", desc: dossier.declarationNumber || "Enregistrement douane", done: isCustomsCleared, current: isCustomsCleared && !isBaeGranted },
                    { id: 4, title: "4. BAE & Quittance", desc: dossier.baeStatus === "Accordé" ? "Bon à enlever accordé" : "Visite & liquidation", done: isBaeGranted, current: isBaeGranted && !isDelivered },
                    { id: 5, title: "5. Sortie & Livraison", desc: dossier.goodsReleaseDate ? `Sortie: ${new Date(dossier.goodsReleaseDate).toLocaleDateString("fr-FR")}` : "Enlèvement quai PAC", done: isDelivered, current: isDelivered },
                  ];

                  return (
                    <div className="relative">
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {steps.map(step => (
                          <div
                            key={step.id}
                            className={`p-3 rounded-2xl border transition ${
                              step.done
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                                : step.current
                                ? "bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-400/20"
                                : "bg-gray-50/60 border-gray-200 text-gray-400"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              {step.done ? (
                                <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                              ) : (
                                <Clock size={15} className={step.current ? "text-amber-700 shrink-0" : "text-gray-400 shrink-0"} />
                              )}
                              <span>{step.title}</span>
                            </div>
                            <p className="text-[11px] mt-1 text-muted-foreground truncate">{step.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Étapes Clés et Convertisseur GNF/USD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-6 border-b">
                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <Ship className="mx-auto h-5 w-5 text-emerald-800" />
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block mt-1">Arrivée Navire (ETA)</span>
                  <strong className="text-xs text-emerald-950">{dossier.eta ? new Date(dossier.eta).toLocaleDateString("fr-FR") : "Non définie"}</strong>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <Anchor className="mx-auto h-5 w-5 text-emerald-800" />
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block mt-1">Port Destination</span>
                  <strong className="text-xs text-emerald-950">{dossier.destinationPort || "Port de Conakry"}</strong>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <FileText className="mx-auto h-5 w-5 text-emerald-800" />
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block mt-1">Déclaration Sydonia</span>
                  <strong className="text-xs text-emerald-950">{dossier.declarationNumber || "En attente"}</strong>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <ShieldCheck className="mx-auto h-5 w-5 text-emerald-800" />
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block mt-1">Taux Référence</span>
                  <strong className="text-xs text-emerald-950">1 USD = 8 650 GNF</strong>
                </div>
              </div>

              {/* Détails du fret */}
              <div className="grid sm:grid-cols-2 gap-4 pt-5 text-xs">
                <div className="space-y-1.5">
                  <p><span className="text-muted-foreground">Marchandise :</span> <strong>{dossier.cargoNature || "N/A"}</strong></p>
                  <p><span className="text-muted-foreground">N° Connaissement (BL) :</span> <strong>{dossier.blLtaNumber}</strong></p>
                  <p><span className="text-muted-foreground">Conditionnement :</span> <strong>{dossier.container || dossier.bulk || "Standard"}</strong></p>
                </div>
                <div className="space-y-1.5">
                  <p><span className="text-muted-foreground">Régime douanier :</span> <strong>{dossier.regime || "Mise à la consommation"}</strong></p>
                  <p><span className="text-muted-foreground">Statut Portuaire PAC :</span> <strong>{dossier.portStatus || "En cours de traitement"}</strong></p>
                  <p><span className="text-muted-foreground">Responsable Transit :</span> <strong>{dossier.responsible || "Équipe IGS Conakry"}</strong></p>
                </div>
              </div>
            </Card>

            {/* Documents & Preuves Disponibles */}
            <Card className="border-0 bg-white p-6 shadow-[0_12px_36px_rgba(20,50,43,0.06)] rounded-3xl">
              <h2 className="font-[Georgia] text-base font-bold text-emerald-950 mb-4">
                Documents & Preuves de Transit ({data.documents.length})
              </h2>
              {data.documents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun document joint n'est encore public pour ce dossier.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 bg-gray-50/50">
                      <div>
                        <Badge variant="outline" className="text-[9px] border-emerald-800 text-emerald-900">{doc.type}</Badge>
                        <p className="text-xs font-semibold text-emerald-950 mt-1 truncate max-w-[200px]">{doc.name}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Certifié IGS</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
