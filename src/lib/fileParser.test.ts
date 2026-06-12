import { describe, it, expect } from "vitest";
import { parseOFXAccount, parseOFXStatements, parseOFXFull } from "./fileParser";

const ofxSgmlBank = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>001
<BRANCHID>1234
<ACCTID>56789-0
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240115<TRNAMT>100.00<FITID>1<MEMO>Test</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const ofxXmlBank = `<?xml version="1.0"?>
<OFX>
  <SIGNONMSGSRSV1><SONRS><FI><ORG>Banco do Brasil</ORG><FID>1</FID></FI></SONRS></SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKACCTFROM>
          <BANKID>001</BANKID>
          <BRANCHID>04321</BRANCHID>
          <ACCTID>00012345-9</ACCTID>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240201</DTPOSTED><TRNAMT>-50.00</TRNAMT><FITID>x</FITID><MEMO>m</MEMO></STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

const ofxCreditCard = `<OFX>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CCACCTFROM><ACCTID>4444333322221111</ACCTID></CCACCTFROM>
<BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240310<TRNAMT>-12.50<FITID>cc1<MEMO>Cafe</STMTTRN></BANKTRANLIST>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

const ofxNonStandardPt = `<OFX>
<AGENCIA>0789</AGENCIA>
<CONTA>11223-4</CONTA>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240505<TRNAMT>10<FITID>1<MEMO>m</STMTTRN>
</OFX>`;

const ofxMultiAccount = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>033<BRANCHID>1111<ACCTID>10001-1</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240101<TRNAMT>-5<FITID>a<MEMO>m</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240102<TRNAMT>15<FITID>b<MEMO>m</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS>
<STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>033<BRANCHID>2222<ACCTID>20002-2</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240103<TRNAMT>200<FITID>c<MEMO>m</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const ofxAgencyWithMask = `<OFX>
<BANKACCTFROM><BRANCHID>0123-4</BRANCHID><ACCTID> 9988-7 </ACCTID></BANKACCTFROM>
</OFX>`;

describe("parseOFXAccount", () => {
  it("extrai agência e conta de OFX SGML", () => {
    const a = parseOFXAccount(ofxSgmlBank);
    expect(a.agencia).toBe("1234");
    expect(a.conta).toBe("56789-0");
    expect(a.banco).toBe("001");
  });

  it("extrai agência e conta de OFX XML com fechamento", () => {
    const a = parseOFXAccount(ofxXmlBank);
    expect(a.agencia).toBe("04321");
    expect(a.conta).toBe("00012345-9");
    expect(a.banco).toBe("Banco do Brasil");
  });

  it("suporta cartão de crédito (CCACCTFROM) sem agência", () => {
    const a = parseOFXAccount(ofxCreditCard);
    expect(a.agencia).toBeUndefined();
    expect(a.conta).toBe("4444333322221111");
  });

  it("aceita tags em português AGENCIA/CONTA como fallback", () => {
    const a = parseOFXAccount(ofxNonStandardPt);
    expect(a.agencia).toBe("0789");
    expect(a.conta).toBe("11223-4");
  });

  it("normaliza agência (somente dígitos) e remove espaços da conta", () => {
    const a = parseOFXAccount(ofxAgencyWithMask);
    expect(a.agencia).toBe("01234");
    expect(a.conta).toBe("9988-7");
  });

  it("retorna campos vazios quando não há dados", () => {
    const a = parseOFXAccount("<OFX></OFX>");
    expect(a.agencia).toBeUndefined();
    expect(a.conta).toBeUndefined();
  });
});

describe("parseOFXStatements", () => {
  it("retorna 1 statement quando há uma conta", () => {
    const s = parseOFXStatements(ofxSgmlBank);
    expect(s).toHaveLength(1);
    expect(s[0].account.conta).toBe("56789-0");
    expect(s[0].records).toHaveLength(1);
  });

  it("retorna múltiplos statements quando o OFX tem várias contas", () => {
    const s = parseOFXStatements(ofxMultiAccount);
    expect(s).toHaveLength(2);
    expect(s[0].account.agencia).toBe("1111");
    expect(s[0].account.conta).toBe("10001-1");
    expect(s[0].records).toHaveLength(2);
    expect(s[1].account.agencia).toBe("2222");
    expect(s[1].account.conta).toBe("20002-2");
    expect(s[1].records).toHaveLength(1);
  });

  it("parseOFXFull agrega todos os registros e expõe statements", () => {
    const full = parseOFXFull(ofxMultiAccount);
    expect(full.statements).toHaveLength(2);
    expect(full.records).toHaveLength(3);
    expect(full.account.conta).toBe("10001-1");
  });
});
