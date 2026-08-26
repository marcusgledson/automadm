/** Utilitários de CNPJ: máscara, limpeza e validação por dígito verificador. */

export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Formata progressivamente: 00.000.000/0000-00 */
export function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function checkDigit(base: string, weights: number[]): number {
  const sum = base.split("").reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Valida os dois dígitos verificadores do CNPJ. */
export function isCnpjValid(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const dv1 = checkDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = checkDigit(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const TIPOS_INSTITUICAO = [
  { id: "empresa_privada", label: "Empresa privada" },
  { id: "mei", label: "MEI / Autônomo" },
  { id: "orgao_publico", label: "Órgão público" },
  { id: "ong", label: "ONG / Terceiro setor" },
  { id: "cooperativa", label: "Cooperativa" },
  { id: "condominio", label: "Condomínio" },
  { id: "escritorio", label: "Escritório / Consultoria" },
  { id: "outro", label: "Outro" },
] as const;

export function tipoInstituicaoLabel(id?: string | null): string {
  return TIPOS_INSTITUICAO.find((t) => t.id === id)?.label ?? "Outro";
}

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
