import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Eye,
  FileText,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Lock,
  Globe,
} from "lucide-react";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: number;
    name: string;
    type: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string | null;
    version?: number;
    isPublic?: boolean;
    description?: string | null;
    uploaderName?: string | null;
    createdAt?: Date | string;
  } | null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  if (!document) return null;

  const isPdf =
    document.mimeType?.includes("pdf") ||
    document.name.toLowerCase().endsWith(".pdf") ||
    document.fileUrl.startsWith("data:application/pdf");

  const isImage =
    document.mimeType?.includes("image") ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(document.name) ||
    document.fileUrl.startsWith("data:image/");

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const formattedSize = document.fileSize
    ? `${Math.round(document.fileSize / 1024)} KB`
    : "—";

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className={`max-w-5xl bg-card border-border p-0 overflow-hidden flex flex-col ${
          isFullscreen ? "w-screen h-screen max-w-none rounded-none" : "max-h-[90vh] h-[85vh]"
        }`}
      >
        {/* Header */}
        <DialogHeader className="p-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="truncate max-w-md">{document.name}</span>
                <Badge variant="outline" className="text-xs bg-background">
                  v{document.version || 1}
                </Badge>
                {document.isPublic ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Public Client
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Interne IGS
                  </Badge>
                )}
              </DialogTitle>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>Type: <strong>{document.type}</strong></span>
                <span>•</span>
                <span>Taille: {formattedSize}</span>
                {document.uploaderName && (
                  <>
                    <span>•</span>
                    <span>Ajouté par: {document.uploaderName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-1.5 mr-6">
            {isImage && (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomOut} title="Zoom arrière">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono text-muted-foreground w-12 text-center">{zoom}%</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomIn} title="Zoom avant">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRotate} title="Pivoter de 90°">
                  <RotateCw className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Réduire" : "Plein écran"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <a href={document.fileUrl} download={document.name} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Télécharger
              </Button>
            </a>
          </div>
        </DialogHeader>

        {/* Document Viewer Body */}
        <div className="flex-1 bg-muted/20 relative overflow-auto flex items-center justify-center p-4">
          {isPdf ? (
            <iframe
              src={`${document.fileUrl}#toolbar=1&navpanes=0`}
              title={document.name}
              className="w-full h-full rounded border border-border bg-white shadow-sm"
            />
          ) : isImage ? (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center">
              <img
                src={document.fileUrl}
                alt={document.name}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease-in-out",
                }}
                className="max-w-full max-h-[70vh] object-contain rounded shadow-md"
              />
            </div>
          ) : (
            <div className="text-center p-8 bg-card border border-border rounded-xl shadow-sm max-w-md">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h4 className="text-base font-bold text-foreground mb-1">{document.name}</h4>
              <p className="text-xs text-muted-foreground mb-4">
                La prévisualisation intégrée n'est pas directement supportée pour ce format. Vous pouvez télécharger le document pour le consulter.
              </p>
              <a href={document.fileUrl} download={document.name}>
                <Button className="gap-2">
                  <Download className="w-4 h-4" /> Télécharger le fichier ({formattedSize})
                </Button>
              </a>
            </div>
          )}
        </div>

        {/* Footer Info */}
        {document.description && (
          <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">Note :</span>
            <span>{document.description}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
