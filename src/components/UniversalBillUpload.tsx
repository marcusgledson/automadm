import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toBillRow, type ExtractedInvoice } from "@/lib/billMapper";
import {
  useConsumptionBills, DUPLICATE_MESSAGE, type BillType,
} from "@/hooks/useConsumptionBills";

const TYPES: { value: BillType; label: string }[] = [
  { value: "energia", label: "Energia Elétrica" },
  { value: "internet", label: "Internet / Telefone" },
  { value: "agua", label: "Água / Saneamento" },
  { value: "gas", label: "Gás" },
  { value: "iptu", label: "IPTU" },
  { value: "ipva", label: "IPVA" },
  { value: "taxa", label: "Taxa Municipal/Estadual" },
  { value: "telefone", label: "Telefonia" },
  { value: "outro", label: "Outro" },
];

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const raw = new TextDecoder("latin1").decode(bytes);
  let text = "";
  const m = raw.match(/\(([^)]+)\)/g);
  if (m) text = m.map((s) => s.slice(1, -1)).join(" ");
  const seg = raw.match(/[A-Za-zÀ-ÿ0-9\s.,;:\/\-@#$%&*()+=]{10,}/g);
  if (seg) text += "\n" + seg.join("\n");
  return text;
}

export default function UniversalBillUpload({ onInserted }: { onInserted?: () => void }) {
  const [tipo, setTipo] = useState<BillType>("energia");
  const [fornecedor, setFornecedor] = useState("");
  const [loading, setLoading] = useState(false);
  const { insertBill } = useConsumptionBills();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    let ok = 0, dup = 0, err = 0;

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast.error(`${file.name}: não é PDF`);
        continue;
      }
      try {
        toast.info(`Processando ${file.name}…`);
        const pdfText = await extractPdfText(file);
        const { data, error } = await supabase.functions.invoke("parse-bill", {
          body: { pdfText, fileName: file.name, tipo_conta: tipo },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "Falha na IA");

        const row = toBillRow(data.data as ExtractedInvoice, {
          fileName: file.name, tipo_conta: tipo,
          fornecedor: fornecedor.trim() || undefined, source: "upload",
        });
        if ("error" in row) {
          toast.error(`${file.name}: ${row.error}`);
          err++; continue;
        }
        const res = await insertBill(row);
        if (res.ok) { ok++; toast.success(`${file.name} importada`); }
        else if (res.duplicate) { dup++; toast.warning(`${file.name}: ${DUPLICATE_MESSAGE}`); }
        else { err++; toast.error(`${file.name}: ${res.error}`); }
      } catch (e) {
        err++;
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    setLoading(false);
    if (ok > 0) onInserted?.();
    toast.message(`Resultado: ${ok} importada(s), ${dup} duplicada(s), ${err} erro(s).`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-accent" /> Importar Conta de Consumo
        </CardTitle>
        <CardDescription>
          Aceita PDFs de Energia, Internet, Água, IPTU, IPVA, Taxas e outros.
          Validação automática: Código de Instalação + Data de Vencimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de conta</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as BillType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fornecedor (opcional)</Label>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Ex: Neoenergia, Vivo, Sabesp" />
          </div>
        </div>
        <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          loading ? "border-muted bg-muted/20 pointer-events-none" : "border-border hover:border-primary hover:bg-primary/5"
        }`}>
          {loading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando com IA…</p>
            </>
          ) : (
            <>
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Clique ou arraste PDFs aqui</p>
              <p className="text-xs text-muted-foreground">Aceita múltiplos arquivos</p>
            </>
          )}
          <input type="file" accept=".pdf" multiple className="hidden"
            disabled={loading}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <Button variant="outline" size="sm" disabled={loading} asChild>
          <Button onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
            Selecionar arquivos
          </Button>
        </Button>
      </CardContent>
    </Card>
  );
}
