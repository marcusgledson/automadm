import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FileText, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toBillRow, type ExtractedInvoice } from "@/lib/billMapper";
import { checkPdfPassword, extractPdfPlainText } from "@/lib/pdfText";
import PdfPasswordDialog, { type PdfPasswordRequest } from "@/components/PdfPasswordDialog";
import BillReviewDialog from "@/components/BillReviewDialog";
import ImportModeSelector from "@/components/ImportModeSelector";
import { useImportMode } from "@/hooks/useImportMode";
import {
  useConsumptionBills, type BillType, type NewBillInput,
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

type FileStage = "aguardando" | "senha" | "lendo" | "ia" | "revisao" | "gravado" | "erro" | "ignorado";

interface FileStatus {
  name: string;
  stage: FileStage;
  detail?: string;
}

const STAGE_LABEL: Record<FileStage, string> = {
  aguardando: "Na fila",
  senha: "Senha necessária",
  lendo: "Lendo PDF",
  ia: "Extraindo dados",
  revisao: "Em conferência",
  gravado: "Gravado",
  erro: "Erro",
  ignorado: "Ignorado",
};

export default function UniversalBillUpload({ onInserted }: { onInserted?: () => void }) {
  const [tipo, setTipo] = useState<BillType>("energia");
  const [fornecedor, setFornecedor] = useState("");
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [pwRequest, setPwRequest] = useState<PdfPasswordRequest | null>(null);
  const pwResolver = useRef<((v: string | null) => void) | null>(null);
  const [review, setReview] = useState<{
    fileName: string; suggestion: NewBillInput; captured: Record<string, unknown>; duplicate: string | null;
  } | null>(null);
  const reviewResolver = useRef<((v: NewBillInput | null) => void) | null>(null);

  const { mode, setMode, readOnly } = useImportMode("contas");
  const { bills, upsertBill } = useConsumptionBills();

  const setStage = (name: string, stage: FileStage, detail?: string) =>
    setStatuses((prev) => prev.map((s) => (s.name === name ? { ...s, stage, detail } : s)));

  const askPassword = (req: PdfPasswordRequest) =>
    new Promise<string | null>((resolve) => { pwResolver.current = resolve; setPwRequest(req); });

  const askReview = (payload: NonNullable<typeof review>) =>
    new Promise<NewBillInput | null>((resolve) => { reviewResolver.current = resolve; setReview(payload); });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${f.name}: não é PDF`);
        return false;
      }
      return true;
    });
    if (list.length === 0) return;

    setLoading(true);
    setStatuses(list.map((f) => ({ name: f.name, stage: "aguardando" as FileStage })));

    let ok = 0, skipped = 0, err = 0;
    // Senha reaproveitada entre arquivos do mesmo lote.
    let sharedPassword: string | undefined;

    for (const file of list) {
      try {
        setStage(file.name, "lendo");
        const buffer = await file.arrayBuffer();

        // 1) Verifica senha: tenta sem senha, depois a senha do lote, depois pergunta.
        let password: string | undefined;
        let check = await checkPdfPassword(buffer);
        if (check.state !== "ok" && sharedPassword) {
          password = sharedPassword;
          check = await checkPdfPassword(buffer, sharedPassword);
        }
        while (check.state === "required" || check.state === "wrong") {
          setStage(file.name, "senha");
          const pw = await askPassword({
            fileNames: [file.name],
            hint: check.hint,
            wrong: check.state === "wrong" || !!password,
          });
          if (!pw) break;
          password = pw;
          check = await checkPdfPassword(buffer, pw);
          if (check.state === "ok") sharedPassword = pw;
        }
        if (check.state !== "ok") {
          skipped++;
          setStage(file.name, check.state === "invalid" ? "erro" : "ignorado",
            check.error ?? "Senha não informada — arquivo não processado.");
          continue;
        }

        // 2) Texto do PDF (layout-aware) e extração assistida por IA
        setStage(file.name, "lendo", "Extraindo texto");
        const pdfText = await extractPdfPlainText(buffer, password);
        if (!pdfText.trim()) throw new Error("Não foi possível ler o texto do PDF.");

        setStage(file.name, "ia");
        const { data, error } = await supabase.functions.invoke("parse-bill", {
          body: { pdfText, fileName: file.name, tipo_conta: tipo },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "Falha na leitura por IA");

        const captured = (data.data ?? {}) as Record<string, unknown>;
        const mapped = toBillRow(captured as ExtractedInvoice, {
          fileName: file.name, tipo_conta: tipo,
          fornecedor: fornecedor.trim() || undefined, source: "upload",
        });

        // Sugestão parcial mesmo quando faltam chaves — a revisão permite corrigir.
        const suggestion: NewBillInput = "error" in mapped
          ? {
              tipo_conta: tipo,
              fornecedor: fornecedor.trim() || (captured.fornecedor as string) || null,
              codigo_instalacao: String(captured.numero_instalacao ?? ""),
              titular: (captured.titular as string) ?? null,
              cpf_cnpj: (captured.cpf_cnpj as string) ?? null,
              endereco: (captured.endereco as string) ?? null,
              mes_referencia: (captured.mes_referencia as string) ?? null,
              data_vencimento: "",
              valor_total: typeof captured.valor_total === "number" ? captured.valor_total : null,
              consumo: typeof captured.consumo === "number" ? captured.consumo : null,
              unidade_consumo: null,
              impostos: {},
              itens: [],
              historico: [],
              raw_data: captured,
              file_name: file.name,
              source: "upload",
            } as NewBillInput
          : mapped;

        const dupe = bills.find(
          (b) => b.codigo_instalacao === suggestion.codigo_instalacao &&
                 b.data_vencimento === suggestion.data_vencimento,
        );

        // 3) Revisão sempre exibida antes de gravar
        setStage(file.name, "revisao");
        const confirmed = await askReview({
          fileName: file.name,
          suggestion,
          captured,
          duplicate: dupe
            ? "Já existe uma conta com esta instalação e vencimento — confirmar irá atualizar o registro existente."
            : null,
        });

        if (!confirmed) {
          skipped++;
          setStage(file.name, "ignorado", "Descartado na conferência");
          continue;
        }

        if (readOnly) {
          setStage(file.name, "gravado", "Modo apenas leitura — nada foi gravado");
          ok++;
          continue;
        }

        const res = await upsertBill(confirmed);
        if (res.ok) { ok++; setStage(file.name, "gravado", dupe ? "Atualizado" : "Importado"); }
        else { err++; setStage(file.name, "erro", res.error); }
      } catch (e) {
        err++;
        setStage(file.name, "erro", e instanceof Error ? e.message : "erro");
      }
    }

    setLoading(false);
    if (ok > 0 && !readOnly) onInserted?.();
    toast.message(`Resultado: ${ok} processada(s), ${skipped} ignorada(s), ${err} erro(s).`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-accent" /> Importar Conta de Consumo
        </CardTitle>
        <CardDescription>
          Aceita PDFs de Energia, Internet, Água, IPTU, IPVA, Taxas e boletos de tributos.
          PDFs protegidos pedem a senha em um pop-up e a leitura é conferida antes da gravação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ImportModeSelector mode={mode} onChange={setMode} />

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
              <p className="text-sm text-muted-foreground">Processando…</p>
            </>
          ) : (
            <>
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Clique ou arraste PDFs aqui</p>
              <p className="text-xs text-muted-foreground">Aceita múltiplos arquivos, inclusive protegidos por senha</p>
            </>
          )}
          <input type="file" accept=".pdf" multiple className="hidden"
            disabled={loading}
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
        </label>

        {statuses.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-border p-2">
            {statuses.map((s) => (
              <li key={s.name} className="flex items-center gap-2 px-1 py-1 text-xs">
                {s.stage === "gravado" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  : s.stage === "erro" ? <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  : s.stage === "senha" ? <Lock className="h-3.5 w-3.5 text-amber-500" />
                  : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="flex-1 truncate" title={s.name}>{s.name}</span>
                <Badge variant={s.stage === "erro" ? "destructive" : "secondary"} className="text-[10px]">
                  {STAGE_LABEL[s.stage]}
                </Badge>
                {s.detail && <span className="max-w-[40%] truncate text-muted-foreground" title={s.detail}>{s.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <PdfPasswordDialog
        request={pwRequest}
        onSubmit={(pw) => { setPwRequest(null); pwResolver.current?.(pw); pwResolver.current = null; }}
        onSkip={() => { setPwRequest(null); pwResolver.current?.(null); pwResolver.current = null; }}
      />

      <BillReviewDialog
        open={!!review}
        fileName={review?.fileName ?? ""}
        suggestion={review?.suggestion ?? null}
        captured={review?.captured ?? {}}
        duplicateWarning={review?.duplicate ?? null}
        onCancel={() => { setReview(null); reviewResolver.current?.(null); reviewResolver.current = null; }}
        onConfirm={(row) => { setReview(null); reviewResolver.current?.(row); reviewResolver.current = null; }}
      />
    </Card>
  );
}
