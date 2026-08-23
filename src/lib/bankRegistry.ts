/**
 * Registro local de bancos brasileiros (código COMPE → nome + apelidos).
 * Custo zero: usado para identificar o banco a partir do texto já extraído
 * do OFX/PDF, sem nenhuma chamada de rede ou IA.
 */

export interface BankEntry {
  /** Código COMPE (3 dígitos). */
  code: string;
  /** Nome oficial resumido. */
  name: string;
  /** Apelidos / termos que aparecem nos extratos (sem acento, minúsculo). */
  aliases: string[];
}

export const BANKS: BankEntry[] = [
  { code: "001", name: "Banco do Brasil", aliases: ["banco do brasil", "bb", "bancodobrasil"] },
  { code: "003", name: "Banco da Amazônia", aliases: ["banco da amazonia", "basa"] },
  { code: "004", name: "Banco do Nordeste", aliases: ["banco do nordeste", "bnb"] },
  { code: "021", name: "Banestes", aliases: ["banestes"] },
  { code: "025", name: "Banco Alfa", aliases: ["banco alfa"] },
  { code: "033", name: "Santander", aliases: ["santander", "banco santander"] },
  { code: "036", name: "Banco Bradesco BBI", aliases: ["bradesco bbi"] },
  { code: "037", name: "Banpará", aliases: ["banpara", "banco do estado do para"] },
  { code: "041", name: "Banrisul", aliases: ["banrisul", "banco do estado do rio grande do sul"] },
  { code: "047", name: "Banco do Estado de Sergipe", aliases: ["banese"] },
  { code: "070", name: "BRB - Banco de Brasília", aliases: ["brb", "banco de brasilia"] },
  { code: "077", name: "Banco Inter", aliases: ["banco inter", "inter"] },
  { code: "084", name: "Uniprime Norte do Paraná", aliases: ["uniprime"] },
  { code: "085", name: "Ailos", aliases: ["ailos", "viacredi", "cecred"] },
  { code: "097", name: "Credisis", aliases: ["credisis"] },
  { code: "099", name: "Uniprime Central", aliases: ["uniprime central"] },
  { code: "104", name: "Caixa Econômica Federal", aliases: ["caixa economica federal", "caixa", "cef"] },
  { code: "107", name: "Banco Bocom BBM", aliases: ["bocom", "bbm"] },
  { code: "121", name: "Banco Agibank", aliases: ["agibank"] },
  { code: "136", name: "Unicred", aliases: ["unicred"] },
  { code: "197", name: "Stone", aliases: ["stone pagamentos", "stone"] },
  { code: "208", name: "Banco BTG Pactual", aliases: ["btg pactual", "btg"] },
  { code: "212", name: "Banco Original", aliases: ["banco original", "original"] },
  { code: "218", name: "Banco BS2", aliases: ["bs2"] },
  { code: "222", name: "Banco Credit Agricole", aliases: ["credit agricole"] },
  { code: "224", name: "Banco Fibra", aliases: ["banco fibra"] },
  { code: "237", name: "Bradesco", aliases: ["bradesco", "banco bradesco"] },
  { code: "246", name: "Banco ABC Brasil", aliases: ["abc brasil"] },
  { code: "260", name: "Nu Pagamentos (Nubank)", aliases: ["nubank", "nu pagamentos", "nu financeira"] },
  { code: "290", name: "PagBank (PagSeguro)", aliases: ["pagseguro", "pagbank"] },
  { code: "318", name: "Banco BMG", aliases: ["bmg"] },
  { code: "320", name: "Banco CCB Brasil", aliases: ["ccb brasil"] },
  { code: "323", name: "Mercado Pago", aliases: ["mercado pago", "mercadopago"] },
  { code: "336", name: "Banco C6", aliases: ["c6 bank", "banco c6", "c6"] },
  { code: "341", name: "Itaú Unibanco", aliases: ["itau", "itau unibanco", "banco itau", "unibanco"] },
  { code: "356", name: "Banco Real", aliases: ["banco real"] },
  { code: "364", name: "Gerencianet (Efí)", aliases: ["gerencianet", "efi bank", "efi"] },
  { code: "376", name: "Banco J.P. Morgan", aliases: ["j.p. morgan", "jp morgan"] },
  { code: "380", name: "PicPay", aliases: ["picpay"] },
  { code: "389", name: "Banco Mercantil do Brasil", aliases: ["mercantil do brasil", "mercantil"] },
  { code: "394", name: "Banco Bradesco Financiamentos", aliases: ["bradesco financiamentos"] },
  { code: "399", name: "HSBC", aliases: ["hsbc"] },
  { code: "422", name: "Banco Safra", aliases: ["safra", "banco safra"] },
  { code: "453", name: "Banco Rural", aliases: ["banco rural"] },
  { code: "473", name: "Banco Caixa Geral", aliases: ["caixa geral"] },
  { code: "477", name: "Citibank", aliases: ["citibank", "citi"] },
  { code: "479", name: "Banco ItauBank", aliases: ["itaubank"] },
  { code: "487", name: "Deutsche Bank", aliases: ["deutsche bank"] },
  { code: "505", name: "Banco Credit Suisse", aliases: ["credit suisse"] },
  { code: "600", name: "Banco Luso Brasileiro", aliases: ["luso brasileiro"] },
  { code: "604", name: "Banco Industrial do Brasil", aliases: ["industrial do brasil"] },
  { code: "612", name: "Banco Guanabara", aliases: ["guanabara"] },
  { code: "623", name: "Banco Pan", aliases: ["banco pan", "panamericano"] },
  { code: "633", name: "Banco Rendimento", aliases: ["rendimento"] },
  { code: "637", name: "Banco Sofisa", aliases: ["sofisa"] },
  { code: "641", name: "Banco Alvorada", aliases: ["alvorada"] },
  { code: "652", name: "Itaú Unibanco Holding", aliases: ["itau holding"] },
  { code: "655", name: "Banco Votorantim (BV)", aliases: ["votorantim", "banco bv", "bv financeira"] },
  { code: "707", name: "Banco Daycoval", aliases: ["daycoval"] },
  { code: "739", name: "Banco Cetelem", aliases: ["cetelem"] },
  { code: "745", name: "Banco Citibank S.A.", aliases: ["citibank s.a."] },
  { code: "746", name: "Banco Modal", aliases: ["modal", "modalmais"] },
  { code: "748", name: "Sicredi", aliases: ["sicredi"] },
  { code: "752", name: "BNP Paribas Brasil", aliases: ["bnp paribas"] },
  { code: "756", name: "Sicoob (Bancoob)", aliases: ["sicoob", "bancoob"] },
  { code: "757", name: "Banco Keb Hana", aliases: ["keb hana"] },
];

/** Normaliza texto: minúsculo, sem acento, espaços colapsados. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const BY_CODE = new Map(BANKS.map((b) => [b.code, b]));

export function bankByCode(code: string): BankEntry | undefined {
  const c = code.replace(/\D/g, "");
  if (!c) return undefined;
  return BY_CODE.get(c.padStart(3, "0").slice(-3));
}

/** Procura banco por apelido dentro de um texto normalizado. */
export function bankByAlias(text: string): BankEntry | undefined {
  const t = normalizeText(text);
  let best: { bank: BankEntry; len: number } | undefined;
  for (const bank of BANKS) {
    for (const alias of bank.aliases) {
      if (alias.length < 3) continue;
      const re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(t) && (!best || alias.length > best.len)) {
        best = { bank, len: alias.length };
      }
    }
  }
  return best?.bank;
}
