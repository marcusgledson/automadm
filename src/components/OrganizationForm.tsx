import { useState } from "react";
import { Loader2, Building2, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isCnpjValid, maskCep, maskCnpj, onlyDigits, TIPOS_INSTITUICAO, tipoInstituicaoLabel, UFS } from "@/lib/cnpj";
import { useOrganization, type OrgSummary } from "@/hooks/useOrganization";

interface Props {
  /** Nome do solicitante usado no pedido de acesso. */
  requesterName?: string | null;
  /** Chamado quando a empresa é criada (Máster) ou o pedido de acesso é enviado. */
  onDone?: (result: { kind: "created" | "requested" }) => void;
}

/**
 * Cadastro de Empresa/Organização por CNPJ.
 * Se o CNPJ já existir, exibe os dados públicos e oferece o pedido de acesso ao Máster.
 */
export default function OrganizationForm({ requesterName, onDone }: Props) {
  const { findByCnpj, createOrganization, requestAccess } = useOrganization();

  const [cnpj, setCnpj] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [existing, setExisting] = useState<OrgSummary | null>(null);
  const [saving, setSaving] = useState(false);

  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [tipo, setTipo] = useState("empresa_privada");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  const cnpjOk = isCnpjValid(cnpj);

  const handleCheck = async () => {
    if (!cnpjOk) {
      toast.error("CNPJ inválido. Confira os números digitados.");
      return;
    }
    setChecking(true);
    const found = await findByCnpj(cnpj);
    setExisting(found);
    setChecked(true);
    setChecking(false);
  };

  const resetCnpj = () => {
    setChecked(false);
    setExisting(null);
  };

  const handleCreate = async () => {
    if (razao.trim().length < 3) {
      toast.error("Informe a razão social ou nome da instituição.");
      return;
    }
    setSaving(true);
    const res = await createOrganization({
      cnpj: onlyDigits(cnpj),
      razao_social: razao.trim(),
      nome_fantasia: fantasia.trim() || null,
      tipo_instituicao: tipo,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      cep: onlyDigits(cep) || null,
      logradouro: logradouro.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      uf: uf || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Empresa cadastrada. Você é o Máster desta organização.");
    onDone?.({ kind: "created" });
  };

  const handleRequest = async () => {
    if (!existing) return;
    setSaving(true);
    const res = await requestAccess(existing.id, requesterName ?? null);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pedido enviado ao Máster da empresa. Aguarde a aprovação.");
    onDone?.({ kind: "requested" });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-cnpj">CNPJ da empresa / instituição</Label>
        <div className="flex gap-2">
          <Input
            id="org-cnpj"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={maskCnpj(cnpj)}
            onChange={(e) => {
              setCnpj(onlyDigits(e.target.value));
              resetCnpj();
            }}
          />
          <Button type="button" variant="outline" onClick={handleCheck} disabled={!cnpjOk || checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verificar
          </Button>
        </div>
        {cnpj.length === 14 && !cnpjOk && (
          <p className="text-xs text-destructive">CNPJ inválido — verifique os dígitos.</p>
        )}
      </div>

      {checked && existing && (
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertTitle>Empresa já cadastrada</AlertTitle>
          <AlertDescription className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{existing.razao_social}</p>
              {existing.nome_fantasia && <p className="text-muted-foreground">{existing.nome_fantasia}</p>}
              <p className="text-muted-foreground">
                {tipoInstituicaoLabel(existing.tipo_instituicao)}
                {existing.cidade ? ` · ${existing.cidade}` : ""}
                {existing.uf ? `/${existing.uf}` : ""}
              </p>
            </div>
            <p className="text-muted-foreground">
              Confirme os dados para solicitar acesso. Seu cadastro será criado com o perfil{" "}
              <strong>Leitor</strong> e ficará pendente até a aprovação do Máster da empresa.
            </p>
            <Button onClick={handleRequest} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar e solicitar acesso
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {checked && !existing && (
        <div className="space-y-4 rounded-lg border border-border/60 p-3">
          <p className="text-sm text-muted-foreground">
            CNPJ ainda não cadastrado. Preencha os dados para criar a empresa — você será o Máster.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-razao">Razão social / Nome</Label>
              <Input id="org-razao" value={razao} onChange={(e) => setRazao(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-fantasia">Nome fantasia</Label>
              <Input id="org-fantasia" value={fantasia} onChange={(e) => setFantasia(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de instituição</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_INSTITUICAO.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-tel">Telefone</Label>
              <Input id="org-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">E-mail</Label>
              <Input id="org-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-cep">CEP</Label>
              <Input id="org-cep" inputMode="numeric" value={maskCep(cep)} onChange={(e) => setCep(onlyDigits(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-log">Logradouro</Label>
              <Input id="org-log" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-num">Número</Label>
              <Input id="org-num" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-compl">Complemento</Label>
              <Input id="org-compl" value={complemento} onChange={(e) => setComplemento(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-bairro">Bairro</Label>
              <Input id="org-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-cidade">Cidade</Label>
              <Input id="org-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            Cadastrar empresa
          </Button>
        </div>
      )}
    </div>
  );
}
