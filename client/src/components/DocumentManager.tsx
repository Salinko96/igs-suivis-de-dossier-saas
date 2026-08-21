import React, { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Eye,
  Download,
  Trash2,
  History,
  Shield,
  Lock,
  Globe,
  Plus,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "BL", label: "Connaissement Maritime (BL) / LTA" },
  { value: "Declaration_Douane", label: "Déclaration Douane (SYDONIA / DDI)" },
  { value: "BAE", label: "Bon à Enlever (BAE) / Bon à Délivrer (BAD)" },
  { value: "Facture_Fournisseur", label: "Facture Commerciale Fournisseur" },
  { value: "Facture_Transitaire", label: "Facture Transit / Débours" },
  { value: "Bulletin_Liquidation", label: "Bulletin de Liquidation Douane" },
  { value: "Photos_Marchandise", label: "Photos Marchandise / Empotage Quai" },
  { value: "Autre", label: "Autre Pièce Justificative" },
];

interface DocumentItem {
  id: number;
  dossierId: number;
  name: string;
  type: string;
  fileUrl: string;
  fileSize: number;
  mimeType?: string | null;
  version: number;
  isPublic: boolean;
  previousVersions?: string | null;
  description?: string | null;
  uploaderName?: string | null;
  createdAt: Date | string;
}

interface DocumentManagerProps {
  dossierId: number;
  dossierNumber: string;
  isClientView?: boolean;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  dossierId,
  dossierNumber,
  isClientView = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentItem | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Upload dialog state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; base64: string; type: string; isPublic: boolean; description: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch documents
  const docsQuery = trpc.document.list.useQuery(
    { dossierId, isExternalClient: isClientView },
    { refetchInterval: 10000 }
  );

  const uploadMultiMutation = trpc.document.uploadMulti.useMutation({
    onSuccess: () => {
      toast.success("Documents enregistrés avec succès", {
        description: `${selectedFiles.length} fichier(s) téléversé(s) dans le dossier ${dossierNumber}.`,
      });
      setSelectedFiles([]);
      setUploadModalOpen(false);
      docsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Erreur de téléversement", {
        description: err.message,
      });
    },
  });

  const deleteDocMutation = trpc.document.remove.useMutation({
    onSuccess: () => {
      toast.success("Document supprimé", {
        description: "La pièce jointe a été archivée avec succès.",
      });
      docsQuery.refetch();
    },
  });

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filePromises = Array.from(files).map((file) => {
      return new Promise<{ file: File; base64: string; type: string; isPublic: boolean; description: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          let detectedType = "Autre";
          const lowerName = file.name.toLowerCase();
          if (lowerName.includes("bl") || lowerName.includes("connaissement") || lowerName.includes("lta")) {
            detectedType = "BL";
          } else if (lowerName.includes("sydonia") || lowerName.includes("declaration") || lowerName.includes("douane") || lowerName.includes("ddi")) {
            detectedType = "Declaration_Douane";
          } else if (lowerName.includes("bae") || lowerName.includes("bad") || lowerName.includes("enlever")) {
            detectedType = "BAE";
          } else if (lowerName.includes("facture") || lowerName.includes("inv")) {
            detectedType = "Facture_Fournisseur";
          } else if (lowerName.includes("photo") || lowerName.includes("image") || /\.(jpg|jpeg|png|webp)$/i.test(lowerName)) {
            detectedType = "Photos_Marchandise";
          }

          resolve({
            file,
            base64: reader.result as string,
            type: detectedType,
            isPublic: true,
            description: "",
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const parsedFiles = await Promise.all(filePromises);
    setSelectedFiles(parsedFiles);
    setUploadModalOpen(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isClientView) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isClientView) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleConfirmUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      await uploadMultiMutation.mutateAsync({
        dossierId,
        files: selectedFiles.map((sf) => ({
          name: sf.file.name,
          type: sf.type as any,
          base64Content: sf.base64,
          mimeType: sf.file.type || "application/pdf",
          isPublic: sf.isPublic,
          description: sf.description || null,
          replaceExistingType: true,
        })),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const documents = (docsQuery.data || []) as unknown as DocumentItem[];

  return (
    <div className="space-y-6">
      {/* Upload Drag & Drop Area */}
      {!isClientView && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Glissez-déposez vos documents ici ou cliquez pour parcourir
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Formats acceptés : PDF, PNG, JPEG, Excel. Gestion automatique des versions (v1, v2) et visibilité publique/interne.
          </p>
        </div>
      )}

      {/* Documents List */}
      <Card className="border-border shadow-sm">
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Documents Joints au Dossier
            </CardTitle>
            <CardDescription className="text-xs">
              {documents.length} pièce(s) justificative(s) certifiée(s)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isClientView && (
              <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Ajouter un document
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => docsQuery.refetch()}
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${docsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-border">
          {docsQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Chargement des documents...</div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-2" />
              <p className="text-sm font-medium text-foreground">Aucun document téléversé</p>
              <p className="text-xs text-muted-foreground mt-1">
                Déposez les connaissements BL, déclarations douanières SYDONIA ou BAE ci-dessus.
              </p>
            </div>
          ) : (
            documents.map((doc) => {
              const previousVersionsList: Array<any> = (() => {
                try {
                  return doc.previousVersions ? JSON.parse(doc.previousVersions) : [];
                } catch {
                  return [];
                }
              })();

              const hasHistory = previousVersionsList.length > 0;

              return (
                <div
                  key={doc.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                      {doc.mimeType?.includes("image") ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate max-w-sm">
                          {doc.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-background font-mono">
                          v{doc.version || 1}
                        </Badge>
                        {doc.isPublic ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> Public
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Interne
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span className="font-medium text-foreground">{doc.type}</span>
                        <span>•</span>
                        <span>{Math.round((doc.fileSize || 0) / 1024)} KB</span>
                        <span>•</span>
                        <span>
                          {new Date(doc.createdAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {doc.uploaderName && (
                          <>
                            <span>•</span>
                            <span>{doc.uploaderName}</span>
                          </>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                          "{doc.description}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewDoc(doc)}
                      className="h-8 gap-1 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> Aperçu
                    </Button>

                    <a href={doc.fileUrl} download={doc.name} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Télécharger">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>

                    {hasHistory && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-amber-600 dark:text-amber-400"
                        onClick={() => setHistoryDoc(doc)}
                        title={`Historique (${previousVersionsList.length} ancienne(s) version(s))`}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    )}

                    {!isClientView && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Confirmez-vous la suppression de "${doc.name}" ?`)) {
                            deleteDocMutation.mutate({ id: doc.id });
                          }
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Multi-Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" />
              Confirmation de Téléversement & Typologie
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {selectedFiles.map((sf, idx) => (
              <div key={idx} className="p-3.5 bg-muted/40 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm truncate max-w-md">{sf.file.name}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(sf.file.size / 1024)} KB</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type de Document</Label>
                    <Select
                      value={sf.type}
                      onValueChange={(val) => {
                        const updated = [...selectedFiles];
                        updated[idx].type = val;
                        setSelectedFiles(updated);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((dt) => (
                          <SelectItem key={dt.value} value={dt.value} className="text-xs">
                            {dt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-5">
                    <div>
                      <Label className="text-xs font-semibold">Visibilité Client</Label>
                      <p className="text-[10px] text-muted-foreground">Accessible sur le portail</p>
                    </div>
                    <Switch
                      checked={sf.isPublic}
                      onCheckedChange={(val) => {
                        const updated = [...selectedFiles];
                        updated[idx].isPublic = val;
                        setSelectedFiles(updated);
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Commentaire / Réf. (Optionnel)</Label>
                  <Input
                    placeholder="Ex: Facture originale signée, SYDONIA validé..."
                    value={sf.description}
                    onChange={(e) => {
                      const updated = [...selectedFiles];
                      updated[idx].description = e.target.value;
                      setSelectedFiles(updated);
                    }}
                    className="h-8 text-xs bg-background mt-1"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmUpload} disabled={isUploading} className="gap-1.5">
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Enregistrer ({selectedFiles.length} fichier{selectedFiles.length > 1 ? "s" : ""})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />

      {/* Version History Modal */}
      {historyDoc && (
        <Dialog open={Boolean(historyDoc)} onOpenChange={() => setHistoryDoc(null)}>
          <DialogContent className="max-w-xl bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Historique des Versions — {historyDoc.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white text-xs">Version Actuelle (v{historyDoc.version || 1})</Badge>
                    <span className="font-semibold text-xs">{historyDoc.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Déposé le {new Date(historyDoc.createdAt).toLocaleString("fr-FR")} par {historyDoc.uploaderName || "Opérateur IGS"}
                  </div>
                </div>
                <a href={historyDoc.fileUrl} download={historyDoc.name}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Download className="w-3 h-3" /> Télécharger
                  </Button>
                </a>
              </div>

              {(() => {
                try {
                  const list = historyDoc.previousVersions ? JSON.parse(historyDoc.previousVersions) : [];
                  return list.map((prev: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted/40 border border-border rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Version v{prev.version}</Badge>
                          <span className="font-medium text-xs text-muted-foreground">{prev.name}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Archivé le {new Date(prev.uploadedAt).toLocaleString("fr-FR")}
                        </div>
                      </div>
                      <a href={prev.fileUrl} download={prev.name}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                          <Download className="w-3 h-3" /> Télécharger
                        </Button>
                      </a>
                    </div>
                  ));
                } catch {
                  return null;
                }
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
