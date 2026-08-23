import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Landmark, AlertCircle, CheckCircle2, ScanSearch, Loader2, UserRound } from "lucide-react";
import type { BankDetection } from "@/lib/bankDetect";
import { maskDocument, matchAccount, type KnownAccount } from "@/lib/accountHolder";

export interface AccountKeyResult {
  banco?: string;
  bancoCodigo?: string;
  agencia: string;
  conta: string;
  apelido: string;
  titular?: string;
  documento?: string;
  documentoTipo?: string;
  /** Salvar/atualizar o cadastro desta conta. */
  salvarConta: boolean;
  /** Conta já cadastrada reconhecida. */
  accountId?: string;
}

interface AccountKeyDialogProps {
  open: boolean;
  defaultBanco?: string;
  defaultAgencia?: string;
  defaultConta?: string;
  defaultTitular?: string;
  defaultDocumento?: string;
  defaultDocumentoTipo?: string;
  bankDetection?: BankDetection;
  knownAccounts?: KnownAccount[];
  /** Identificação da logo por IA (opcional, sob demanda). */
  onIdentifyLogo?: () => Promise<{ name: string; code?: string } | null>;
  onConfirm: (data: AccountKeyResult) => void;
  onCancel: () => void;
}

/** Máscara de conta tipo extrato bancário: dígitos + "-" + 1 dígito verificador. Ex.: 12345-6 */
function maskAccount(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 1) return digits;
  return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
}

/** Apenas dígitos para agência, até 6. */
function maskAgency(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

const SOURCE_LABEL: Record<string, string> = {
  codigo: "código do banco",
  nome: "nome no documento",
  logo: "logo (IA)",
  manual: "informado por você",
};

export default function AccountKeyDialog({
  open, defaultBanco, defaultAgencia, defaultConta,
  defaultTitular, defaultDocumento, defaultDocumentoTipo,
  bankDetection, knownAccounts = [], onIdentifyLogo, onConfirm, onCancel,
}: AccountKeyDialogProps) {
  const [banco, setBanco] = useState(defaultBanco ?? "");
  const [bancoCodigo, setBancoCodigo] = useState(bankDetection?.code);
  const [bancoOrigem, setBancoOrigem] = useState(bankDetection?.source);
  const [agencia, setAgencia] = useState(maskAgency(defaultAgencia ?? ""));
  const [conta, setConta] = useState(maskAccount(defaultConta ?? ""));
  const [titular, setTitular] = useState(defaultTitular ?? "");
  const [documento, setDocumento] = useState(defaultDocumento ?? "");
  const [apelido, setApelido] = useState("");
  const [salvarConta, setSalvarConta] = useState(true);
  const [identifying, setIdentifying] = useState(false);

  const detected = useMemo(() => ({
    banco: !!(defaultBanco && defaultBanco.trim()),
    agencia: !!(defaultAgencia && defaultAgencia.trim()),
    conta: !!(defaultConta && defaultConta.trim()),
    titular: !!(defaultTitular && defaultTitular.trim()),
    documento: !!(defaultDocumento && defaultDocumento.trim()),
  }), [defaultBanco, defaultAgencia, defaultConta, defaultTitular, defaultDocumento]);

  const missingList = useMemo(() => {
    const m: string[] = [];
    if (!detected.agencia) m.push("Agência");
    if (!detected.conta) m.push("Conta");
    return m;
  }, [detected]);

  useEffect(() => {
    if (!open) return;
    setBanco(defaultBanco ?? "");
    setBancoCodigo(bankDetection?.code);
    setBancoOrigem(bankDetection?.source);
    setAgencia(maskAgency(defaultAgencia ?? ""));
    setConta(maskAccount(defaultConta ?? ""));
    setTitular(defaultTitular ?? "");
    setDocumento(defaultDocumento ?? "");
    setApelido(defaultTitular?.trim() || defaultBanco?.trim() || "");
    setSalvarConta(true);
  }, [open, defaultBanco, defaultAgencia, defaultConta, defaultTitular, defaultDocumento, bankDetection]);

  const match = useMemo(
    () => matchAccount({ agencia, conta, titular, documento }, knownAccounts),
    [agencia, conta, titular, documento, knownAccounts],
  );

  // Preenche o apelido com o da conta já cadastrada, quando reconhecida.
  useEffect(() => {
    if (match && !apelido) setApelido(match.account.apelido);
  }, [match, apelido]);

  const contaDigits = conta.replace(/\D/g, "");
  const valid = agencia.length >= 1 && contaDigits.length >= 2 && apelido.trim().length >= 2;

  const identifyLogo = async () => {
    if (!onIdentifyLogo) return;
    setIdentifying(true);
    try {
      const res = await onIdentifyLogo();
      if (res?.name) {
        setBanco(res.name);
        setBancoCodigo(res.code);
        setBancoOrigem("logo");
        if (!apelido) setApelido(res.name);
      }
    } finally {
      setIdentifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> Confirmar conta do extrato
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              {missingList.length > 0
                ? "Não foi possível identificar todos os dados no arquivo. Preencha os campos faltantes conforme o seu extrato."
                : "Confirme os dados de identificação extraídos do arquivo. A conta deve incluir o dígito verificador."}
            </span>
            {missingList.length > 0 && (
              <span className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Faltando: <strong>{missingList.join(" e ")}</strong></span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {match && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
              <p className="font-medium text-foreground">
                Conta reconhecida: {match.account.apelido}
                <span className="text-muted-foreground"> · {match.reason === "documento" ? "pelo CPF/CNPJ" : match.reason === "titular" ? "pelo titular" : "pela agência/conta"}</span>
              </p>
              {match.conflicts.map((c) => (
                <p key={c} className="mt-1 flex items-start gap-1 text-destructive">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {c}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="banco">Banco</Label>
              <div className="flex items-center gap-1">
                {banco && bancoOrigem && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> {SOURCE_LABEL[bancoOrigem] ?? "auto"}
                  </Badge>
                )}
                {onIdentifyLogo && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]"
                    onClick={identifyLogo} disabled={identifying}>
                    {identifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanSearch className="h-3 w-3" />}
                    Identificar pela logo
                  </Button>
                )}
              </div>
            </div>
            <Input
              id="banco"
              placeholder="Nome ou código (ex.: 001)"
              value={banco}
              onChange={(e) => { setBanco(e.target.value); setBancoOrigem("manual"); }}
            />
            {bancoCodigo && <p className="text-[11px] text-muted-foreground">Código COMPE: {bancoCodigo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="agencia">Agência</Label>
                {detected.agencia ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> auto
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">obrigatório</Badge>
                )}
              </div>
              <Input
                id="agencia"
                inputMode="numeric"
                placeholder="0000"
                value={agencia}
                onChange={(e) => setAgencia(maskAgency(e.target.value))}
                autoFocus={!detected.agencia}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="conta">Conta + Dígito</Label>
                {detected.conta ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> auto
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">obrigatório</Badge>
                )}
              </div>
              <Input
                id="conta"
                inputMode="numeric"
                placeholder="00000-0"
                value={conta}
                onChange={(e) => setConta(maskAccount(e.target.value))}
                autoFocus={detected.agencia && !detected.conta}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="titular">Titular</Label>
                {detected.titular && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <UserRound className="h-3 w-3" /> auto
                  </Badge>
                )}
              </div>
              <Input id="titular" placeholder="Nome do cliente" value={titular}
                onChange={(e) => setTitular(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="documento">CPF / CNPJ</Label>
                {detected.documento && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> auto
                  </Badge>
                )}
              </div>
              <Input id="documento" placeholder="000.000.000-00" value={documento}
                onChange={(e) => setDocumento(e.target.value)} />
              {documento && (
                <p className="text-[11px] text-muted-foreground">Exibição: {maskDocument(documento)}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apelido">Nome desta conta</Label>
            <Input id="apelido" placeholder="Ex.: Conta da empresa, Conta pessoal"
              value={apelido} onChange={(e) => setApelido(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {[titular, documento, banco].filter((s) => s && s.trim()).map((s) => (
                <Button key={s} type="button" variant="outline" size="sm"
                  className="h-6 px-2 text-[11px]" onClick={() => setApelido(s!)}>
                  usar {s!.length > 22 ? `${s!.slice(0, 22)}…` : s}
                </Button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs">
            <Checkbox checked={salvarConta} onCheckedChange={(v) => setSalvarConta(v === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              Salvar esta conta no cadastro para reconhecer automaticamente extratos futuros
              (compara CPF/CNPJ, agência/conta e titular).
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            disabled={!valid}
            onClick={() => onConfirm({
              banco: banco || undefined,
              bancoCodigo,
              agencia,
              conta,
              apelido: apelido.trim(),
              titular: titular.trim() || undefined,
              documento: documento.trim() || undefined,
              documentoTipo: defaultDocumentoTipo,
              salvarConta,
              accountId: match?.account.id,
            })}
          >
            Confirmar e carregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
