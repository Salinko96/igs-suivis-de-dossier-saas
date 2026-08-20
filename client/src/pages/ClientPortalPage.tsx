import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  KeyRound,
  Loader2,
  Lock,
  Package,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Ship,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const IGS_LOGO = "/igs-logo-transparent.png";

export default function ClientPortalPage() {
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const tokenParam = urlParams?.get("token") || "";

  const [searchCode, setSearchCode] = useState(tokenParam ? "" : "IGS-1001");
  const [submittedCode, setSubmittedCode] = useState(tokenParam ? "" : "IGS-1001");
  const [activeToken, setActiveToken] = useState(tokenParam);

  // OTP Modal State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpCompany, setOtpCompany] = useState("Guinean Birimian Gold S.A");
  const [otpPhone, setOtpPhone] = useState("+224 621 00 11 22");
  const [otpCode, setOtpCode] = useState("");
  const [otpDebugCode, setOtpDebugCode] = useState<string | null>(null);

  const portalQuery = trpc.portal.track.useQuery(
    {
      accessCodeOrNumber: activeToken ? undefined : submittedCode,
      token: activeToken || undefined,
    },
    {
      enabled: Boolean(activeToken || submittedCode.trim()),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const requestOtpMutation = trpc.portal.requestOtp.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      if (res.debugOtpCode) setOtpDebugCode(res.debugOtpCode);
      setOtpStep("verify");
    },
    onError: (err) => {
      toast.error(`Erreur OTP : ${err.message}`);
    },
  });

  const verifyOtpMutation = trpc.portal.verifyOtp.useMutation({
    onSuccess: (res) => {
      toast.success("Authentification OTP réussie ! Vos dossiers sont déverrouillés.");
      if (res.token) {
        setActiveToken(res.token);
      }
      setOtpModalOpen(false);
    },
    onError: (err) => {
      toast.error(`Code OTP invalide : ${err.message}`);
    },
  });

  useEffect(() => {
    if (tokenParam) {
      setActiveToken(tokenParam);
    }
  }, [tokenParam]);

  const sampleCodes = [
    { label: "IGS-1001", desc: "Code de suivi direct" },
    { label: "CKYSI26000340", desc: "Réf. Client Birimian" },
    { label: "HLCUNG12604AUQG1", desc: "N° Connaissement BL" },
  ];

  const triggerSearchWithCode = (code: string) => {
    const trimmed = code.trim();
    if (trimmed) {
      setActiveToken("");
      setSearchCode(trimmed);
      setSubmittedCode(trimmed);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearchWithCode(searchCode);
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
            <Button
              type="submit"
              disabled={portalQuery.isFetching}
              className="h-11 rounded-2xl bg-[#0b3b32] text-white hover:bg-[#164d41] px-5 text-xs font-semibold"
            >
              {portalQuery.isFetching ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 size={15} className="animate-spin" />
                  <span>Recherche...</span>
                </div>
              ) : (
                "Consulter"
              )}
            </Button>
          </form>

          {/* Bouton d'accès OTP & Sécurité Entreprise */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOtpStep("request");
                setOtpModalOpen(true);
              }}
              className="rounded-2xl border-emerald-800/30 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold gap-1.5 h-8"
            >
              <Smartphone size={13} className="text-emerald-800" />
              <span>Accès Espace Client Entreprise (Code OTP)</span>
            </Button>
          </div>

          {/* Badges d'exemples cliquables sous le formulaire */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-medium mr-1">Exemples rapides :</span>
            {sampleCodes.map(sample => (
              <button
                key={sample.label}
                type="button"
                onClick={() => triggerSearchWithCode(sample.label)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-900/20 bg-white px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-50 hover:border-emerald-700 hover:text-emerald-950 cursor-pointer"
              >
                <span className="font-mono font-semibold">{sample.label}</span>
              </button>
            ))}
          </div>

          {/* Bannière de Sécurité Token JWT si actif */}
          {activeToken && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-100/70 border border-emerald-300 px-3.5 py-1.5 text-xs text-emerald-950">
              <ShieldCheck size={14} className="text-emerald-800 shrink-0" />
              <span>Lien sécurisé actif : <strong>Session chiffrée IGS (Valable 7 jours)</strong></span>
            </div>
          )}
        </div>

        {/* Modal d'Authentification OTP pour Sociétés Clientes */}
        <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
          <DialogContent className="max-w-md rounded-3xl bg-white p-6 shadow-2xl border-0">
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 mb-2">
                <KeyRound size={24} />
              </div>
              <DialogTitle className="text-center font-[Georgia] text-xl font-bold text-[#0b3b32]">
                {otpStep === "request" ? "Connexion Espace Entreprise" : "Vérification du Code OTP"}
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-muted-foreground">
                {otpStep === "request"
                  ? "Recevez un code à usage unique par SMS ou email pour consulter l'ensemble de vos dossiers."
                  : `Entrez le code à 6 chiffres envoyé au ${otpPhone || otpCompany}.`}
              </DialogDescription>
            </DialogHeader>

            {otpStep === "request" ? (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Société Cliente / Compte</Label>
                  <Input
                    value={otpCompany}
                    onChange={e => setOtpCompany(e.target.value)}
                    placeholder="Ex: Guinean Birimian Gold S.A"
                    className="h-10 text-xs rounded-xl border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Numéro de Téléphone (SMS) ou Email</Label>
                  <Input
                    value={otpPhone}
                    onChange={e => setOtpPhone(e.target.value)}
                    placeholder="+224 621 00 11 22 ou contact@societe.gn"
                    className="h-10 text-xs rounded-xl border-gray-200"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    onClick={() => {
                      if (!otpCompany.trim()) {
                        toast.error("Veuillez saisir le nom de votre société.");
                        return;
                      }
                      requestOtpMutation.mutate({
                        clientCompany: otpCompany,
                        phone: otpPhone,
                      });
                    }}
                    disabled={requestOtpMutation.isPending}
                    className="w-full h-10 rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs font-semibold"
                  >
                    {requestOtpMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                    Recevoir le Code OTP (SMS / Email)
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Code de Sécurité à 6 chiffres</Label>
                  <Input
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    placeholder="Ex: 849201"
                    maxLength={6}
                    className="h-12 text-center font-mono text-lg tracking-widest font-bold rounded-xl border-emerald-600 focus:ring-emerald-700"
                  />
                </div>

                {otpDebugCode && (
                  <div className="rounded-xl bg-amber-50 p-2.5 text-center text-xs text-amber-900 border border-amber-200">
                    <span className="font-semibold">Code de test (Développement) : </span>
                    <strong className="font-mono text-sm tracking-wider">{otpDebugCode}</strong>
                  </div>
                )}

                <DialogFooter className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => {
                      if (!otpCode.trim() || otpCode.trim().length < 4) {
                        toast.error("Veuillez saisir le code complet à 6 chiffres.");
                        return;
                      }
                      verifyOtpMutation.mutate({
                        clientCompany: otpCompany,
                        otpCode: otpCode.trim(),
                      });
                    }}
                    disabled={verifyOtpMutation.isPending}
                    className="w-full h-10 rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs font-semibold"
                  >
                    {verifyOtpMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                    Valider & Consulter mes Dossiers
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOtpStep("request")}
                    className="text-xs text-muted-foreground"
                  >
                    Renvoyer un nouveau code
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Résultat du Suivi - Indicateur de chargement */}
        {portalQuery.isFetching && (
          <div className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-800" />
            <p className="text-xs text-muted-foreground mt-2 font-medium">Recherche des informations maritimes et douanières...</p>
          </div>
        )}

        {/* Résultat du Suivi - Carte d'erreur claire et stylée */}
        {!portalQuery.isFetching && portalQuery.isError && (
          <Card className="border-rose-200 bg-white p-6 sm:p-8 text-center rounded-3xl shadow-sm max-w-xl mx-auto space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <Search size={22} />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-sm text-rose-950">Dossier introuvable</h3>
              <p className="font-semibold text-xs text-rose-800">
                « Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez. »
              </p>
              <p className="text-[11px] text-muted-foreground">
                Le code saisi (« <span className="font-mono font-semibold text-rose-950">{submittedCode}</span> ») ne correspond à aucun dossier en cours d'acheminement ou de dédouanement.
              </p>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">Cliquez sur un dossier exemple pour tester :</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {sampleCodes.map(sample => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => triggerSearchWithCode(sample.label)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                  >
                    <span className="font-mono">{sample.label}</span>
                    <span className="text-[10px] text-emerald-700 font-normal">({sample.desc})</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}

        {!portalQuery.isFetching && !portalQuery.isError && dossier && (
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
