import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from "lucide-react";

/* ── canvas helper ── */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  outputSize = 256,
): Promise<Blob> {
  const image = await createImageBitmap(
    await fetch(imageSrc).then((r) => r.blob()),
  );

  const canvas = document.createElement("canvas");
  canvas.width  = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0, outputSize, outputSize,
  );

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
      "image/jpeg",
      0.92,
    ),
  );
}

/* ── types ── */
interface Area { x: number; y: number; width: number; height: number }

interface ImageCropModalProps {
  open: boolean;
  src: string;
  aspect?: number;
  outputSize?: number;
  title?: string;
  onConfirm: (blob: Blob, filename: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  open,
  src,
  aspect = 1,
  outputSize = 256,
  title = "Recortar imagem",
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop,      setCrop]      = useState({ x: 0, y: 0 });
  const [zoom,      setZoom]      = useState(1);
  const [croppedPx, setCroppedPx] = useState<Area | null>(null);
  const [working,   setWorking]   = useState(false);

  const onCropComplete = useCallback((_: Area, px: Area) => {
    setCroppedPx(px);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleConfirm = async () => {
    if (!croppedPx) return;
    setWorking(true);
    try {
      const blob = await getCroppedBlob(src, croppedPx, outputSize);
      onConfirm(blob, "cropped.jpg");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent
        className="max-w-sm w-full p-0 overflow-hidden border-border/60 bg-card"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/60">
            Arraste para reposicionar &middot; use o slider para ampliar
          </DialogDescription>
        </DialogHeader>

        {/* ── Crop area ── */}
        <div className="relative mx-5 mt-4 rounded-xl overflow-hidden bg-black/60"
             style={{ height: 280 }}>
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={aspect === 1 ? "round" : "rect"}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { borderRadius: "12px" },
                cropAreaStyle: {
                  border: "2px solid hsl(var(--primary))",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                },
              }}
            />
          )}
        </div>

        {/* ── Zoom slider ── */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <Slider
              min={1} max={3} step={0.05}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between px-5 pb-5 pt-1 gap-2">
          <Button
            variant="ghost" size="sm"
            onClick={handleReset}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={onCancel}
              disabled={working}
              className="gap-1.5 border-border/60"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={working || !croppedPx}
              className="gap-1.5"
            >
              {working ? (
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
