import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const COUNTRY_CODES = [
  { code: "+55", label: "Brasil (+55)" },
  { code: "+1", label: "EUA / Canadá (+1)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+34", label: "Espanha (+34)" },
  { code: "+44", label: "Reino Unido (+44)" },
  { code: "+49", label: "Alemanha (+49)" },
  { code: "+33", label: "França (+33)" },
  { code: "+39", label: "Itália (+39)" },
  { code: "+81", label: "Japão (+81)" },
  { code: "+54", label: "Argentina (+54)" },
];

export interface PhoneValue {
  country: string;
  area: string;
  number: string;
  whatsapp: boolean;
}

export function maskPhoneNumber(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isPhoneValid(v: PhoneValue) {
  const digits = v.number.replace(/\D/g, "");
  return !!v.country && v.area.replace(/\D/g, "").length >= 2 && digits.length >= 8;
}

interface Props {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  showWhatsapp?: boolean;
  idPrefix?: string;
}

export default function PhoneField({ value, onChange, showWhatsapp = true, idPrefix = "phone" }: Props) {
  return (
    <div className="space-y-2">
      <Label>Telefone</Label>
      <div className="grid grid-cols-[7.5rem_5rem_1fr] gap-2">
        <Select value={value.country} onValueChange={(country) => onChange({ ...value, country })}>
          <SelectTrigger id={`${idPrefix}-country`} aria-label="Código do país">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={`${idPrefix}-area`}
          inputMode="numeric"
          placeholder="DDD"
          maxLength={3}
          value={value.area}
          onChange={(e) => onChange({ ...value, area: e.target.value.replace(/\D/g, "") })}
        />
        <Input
          id={`${idPrefix}-number`}
          inputMode="numeric"
          placeholder="00000-0000"
          value={value.number}
          onChange={(e) => onChange({ ...value, number: maskPhoneNumber(e.target.value) })}
        />
      </div>
      {showWhatsapp && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={value.whatsapp}
            onCheckedChange={(c) => onChange({ ...value, whatsapp: c === true })}
          />
          Este número é WhatsApp
        </label>
      )}
    </div>
  );
}
