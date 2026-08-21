import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PhoneField, { type PhoneValue } from "@/components/PhoneField";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type Gender, type ProfilePatch } from "@/hooks/useProfile";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "masculino", label: "Masculino" },
  { id: "feminino", label: "Feminino" },
  { id: "nao_informar", label: "Prefiro não informar" },
];

const FIELD_LABEL: Record<string, string> = {
  full_name: "Nome completo",
  display_name: "Nome de exibição",
  gender: "Gênero",
  phone_country_code: "País (telefone)",
  phone_area_code: "DDD",
  phone_number: "Telefone",
  phone_is_whatsapp: "É WhatsApp",
};

function show(v: unknown) {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  if (v === null || v === undefined || v === "") return "(vazio)";
  const g = GENDERS.find((x) => x.id === v);
  return g ? g.label : String(v);
}

/** Fase 3 — atualização das informações pessoais com comparação e confirmação. */
export default function ProfileUpdatePanel() {
  const { user } = useAuth();
  const { profile, loading, save, refresh } = useProfile();
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [phone, setPhone] = useState<PhoneValue>({ country: "+55", area: "", number: "", whatsapp: false });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setDisplayName(profile.display_name ?? "");
    setGender((profile.gender as Gender) ?? "");
    setPhone({
      country: profile.phone_country_code ?? "+55",
      area: profile.phone_area_code ?? "",
      number: profile.phone_number ?? "",
      whatsapp: !!profile.phone_is_whatsapp,
    });
  }, [profile]);

  const changes = useMemo(() => {
    if (!profile) return [] as { field: string; from: unknown; to: unknown }[];
    const next: Record<string, unknown> = {
      full_name: fullName.trim() || null,
      display_name: displayName.trim() || null,
      gender: gender || null,
      phone_country_code: phone.country || null,
      phone_area_code: phone.area || null,
      phone_number: phone.number || null,
      phone_is_whatsapp: phone.whatsapp,
    };
    const current: Record<string, unknown> = {
      full_name: profile.full_name ?? null,
      display_name: profile.display_name ?? null,
      gender: profile.gender ?? null,
      phone_country_code: profile.phone_country_code ?? null,
      phone_area_code: profile.phone_area_code ?? null,
      phone_number: profile.phone_number ?? null,
      phone_is_whatsapp: !!profile.phone_is_whatsapp,
    };
    return Object.keys(next)
      .filter((k) => next[k] !== current[k])
      .map((k) => ({ field: k, from: current[k], to: next[k] }));
  }, [profile, fullName, displayName, gender, phone]);

  const apply = async () => {
    setSaving(true);
    const patch = changes.reduce<Record<string, unknown>>((acc, c) => {
      acc[c.field] = c.to;
      return acc;
    }, {});
    const res = await save(patch as ProfilePatch);
    setSaving(false);
    setConfirmOpen(false);
    if (!res.ok) {
      toast.error(res.error ?? "Falha ao atualizar as informações.");
      return;
    }
    toast.success("Informações atualizadas com sucesso.");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">E-mail cadastrado</Label>
        <Input value={user?.email ?? ""} disabled />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pf-nome">Nome completo</Label>
          <Input id="pf-nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pf-exib">Nome de exibição</Label>
          <Input id="pf-exib" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Gênero</Label>
        <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {GENDERS.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <PhoneField value={phone} onChange={setPhone} idPrefix="pf" />

      <div className="flex items-center gap-2">
        <Button className="flex-1" onClick={() => setConfirmOpen(true)} disabled={changes.length === 0}>
          <UserRoundCog className="mr-2 h-4 w-4" /> Atualiza Informações!
        </Button>
        <Button variant="outline" onClick={() => void refresh()} title="Descartar alterações">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {changes.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Nenhuma alteração pendente.</p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !saving && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização</AlertDialogTitle>
            <AlertDialogDescription>
              Estes campos serão alterados no seu cadastro:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {changes.map((c) => (
              <div key={c.field} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <p className="font-medium">{FIELD_LABEL[c.field] ?? c.field}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="line-through">{show(c.from)}</span> → <strong>{show(c.to)}</strong>
                </p>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void apply();
              }}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
