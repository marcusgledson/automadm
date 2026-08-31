import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw, ZoomIn } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Arquivo/URL da imagem selecionada. */
  file: File | null;
  /** Proporção do quadro de recorte (largura/altura). */
  aspect?: number;
  /** Recebe a imagem recortada em dataURL (JPEG). */
  onCropped: (dataUrl: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderCrop(src: string, area: Area, rotation: number): Promise<string> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;

  // Canvas auxiliar com a imagem já rotacionada.
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bw = img.width * cos + img.height * sin;
  const bh = img.width * sin + img.height * cos;
  const base = document.createElement("canvas");
  base.width = bw;
  base.height = bh;
  const bctx = base.getContext("2d")!;
  bctx.translate(bw / 2, bh / 2);
  bctx.rotate(rad);
  bctx.drawImage(img, -img.width / 2, -img.height / 2);

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(area.width));
  out.height = Math.max(1, Math.round(area.height));
  const octx = out.getContext("2d")!;
  octx.drawImage(base, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);

  // Limita o lado maior a 1600px para manter o arquivo leve.
  const max = 1600;
  if (out.width > max || out.height > max) {
    const scale = max / Math.max(out.width, out.height);
    const small = document.createElement("canvas");
    small.width = Math.round(out.width * scale);
    small.height = Math.round(out.height * scale);
    small.getContext("2d")!.drawImage(out, 0, 0, small.width, small.height);
    return small.toDataURL("image/jpeg", 0.88);
  }
  return out.toDataURL("image/jpeg", 0.9);
}

/** Seleção com enquadramento: permite mover, aproximar e girar antes de salvar. */
export default function ImageCropDialog({ open, onOpenChange, file, aspect = 4 / 3, onCropped }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const confirm = async () => {
    if (!src || !area) return;
    setBusy(true);
    try {
      const dataUrl = await renderCrop(src, area, rotation);
      onCropped(dataUrl);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enquadrar imagem</DialogTitle>
          <DialogDescription>
            Arraste para posicionar, use o zoom para aproximar e gire se precisar. Só a área do quadro será salva.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted sm:h-80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onComplete}
              restrictPosition
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <ZoomIn className="h-3.5 w-3.5" /> Zoom
            </Label>
            <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={([v]) => setZoom(v)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <RotateCw className="h-3.5 w-3.5" /> Rotação
            </Label>
            <Slider value={[rotation]} min={-180} max={180} step={1} onValueChange={([v]) => setRotation(v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={busy || !area}>
            {busy ? "Processando..." : "Usar imagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
