# Identificação de banco e leitura inteligente de colunas (Extrato PDF/OFX)

## 1. Identificação do banco ao confirmar Agência/Conta

Estratégia em cascata, do mais barato para o mais caro — a leitura de imagem só acontece se tudo antes falhar.

1. **Código do banco (custo zero)** — procurar no texto já extraído: `BANKID`/`ORG`/`FID` (OFX), padrões `Banco 001`, `033 -`, `COMPE`, ISPB de 8 dígitos, e o número no rodapé de boletos/extratos. Cruzar com uma tabela local dos ~60 bancos brasileiros mais comuns (código COMPE → nome + apelido).
2. **Nome por dicionário (custo zero)** — casar trechos do texto contendo "Banco"/"Bank"/"Caixa"/"Sicoob"/"Sicredi"/"Nubank"/"Inter"/"C6" etc. com o mesmo dicionário, incluindo variações sem acento.
3. **Logo por imagem (opcional, sob demanda)** — só se 1 e 2 falharem: recortar a faixa superior da 1ª página do PDF, renderizar em baixa resolução e enviar para a IA (visão) identificar o banco. Nunca automático em lote: aparece como botão "Identificar banco pela logo" no diálogo de confirmação.

### Análise de custo (pedida antes de implementar)


| Etapa               | Custo                              | Impacto no desempenho                    |
| ------------------- | ---------------------------------- | ---------------------------------------- |
| Código do banco     | Regex sobre texto já extraído      | Desprezível (<5 ms)                      |
| Dicionário de nomes | Busca local em ~60 entradas        | Desprezível                              |
| Logo via IA         | 1 chamada de IA + render de imagem | ~1–3 s e consumo de créditos por arquivo |


Conclusão: as etapas 1 e 2 resolvem a grande maioria dos extratos sem nenhum custo. A leitura da logo fica **desativada por padrão** e é acionada manualmente, evitando degradar a importação em lote (Google Drive) e o gasto de créditos.

## 2. Leitura inteligente de colunas (por banco, não genérica)

Hoje o parser de PDF lê linha a linha com regex de data + valor. Será substituído por um leitor com consciência de layout:

1. **Extrair itens com coordenadas** (x, y) — já disponível no pdf.js, hoje descartado.
2. **Detectar a linha de cabeçalho** — procurar a linha que contenha rótulos conhecidos: Data, Data Mov., Lançamento, Histórico, Descrição, Documento, Nº Doc, Débito, Crédito, Valor, Saldo, Tipo, Categoria.
3. **Montar as faixas de coluna** a partir da posição x de cada rótulo; cada célula das linhas seguintes é atribuída à coluna cuja faixa contém seu x.
4. **Mapear rótulo → campo** do registro (data, descrição, documento, valor, saldo), tratando os formatos comuns: colunas Débito/Crédito separadas, coluna única com sufixo C/D, valor negativo com sinal, saldo ignorado como lançamento.
5. **Continuação de linhas** — linhas sem data e sem valor são anexadas à descrição do lançamento anterior.
6. **Rodapés/cabeçalhos repetidos e totais** são descartados por padrão (linhas com "Saldo anterior", "Total", numeração de página).
7. **Fallback** — se nenhum cabeçalho for reconhecido, usa o parser atual (linha a linha) para não regredir nos arquivos que já funcionam.
8. **Confirmação visual** — a pré-visualização existente passa a mostrar o mapeamento detectado (ex.: "Coluna 3 → Descrição") e permite corrigir o campo de cada coluna antes de gravar.

## 3. Titular da conta (Nome / CPF / CNPJ) como identidade da conta

Todo extrato traz o nome do cliente e/ou CPF/CNPJ. Esses dados passam a ser extraídos e usados para nomear e reconhecer a conta.

1. **Extração** — regex sobre o texto do PDF/OFX para CPF (`000.000.000-00`), CNPJ (`00.000.000/0000-00`) e nome do titular (linhas com "Cliente", "Titular", "Nome", ou a linha próxima ao documento). Custo zero, sem IA.
2. **Escolha do usuário** — no diálogo de confirmação de Agência/Conta, os dados detectados aparecem e o usuário decide o **apelido da conta** (ex.: nome do titular, CNPJ da empresa, ou um nome livre). Nada é gravado sem confirmação.
3. **Gravação** — o apelido, o titular e o documento (CPF/CNPJ, guardado mascarado na exibição) ficam associados à chave Agência+Conta, para reuso.
4. **Importações futuras** — ao abrir um novo arquivo, a detecção compara campo a campo (documento → agência/conta → nome) e já sugere a conta correspondente; se houver conflito (mesmo documento com agência/conta diferentes, ou mesma conta com outro titular) o usuário é avisado antes de gravar.
5. **Antiduplicidade** — mantém-se a chave atual de lançamento (FITID / agência+conta+data+valor+descrição) e o vínculo à conta identificada, evitando reimportar o mesmo extrato em conta errada ou duplicada.  Informando em pop-up que o extrato já foi importado.

## Detalhes técnicos

- `src/lib/bankRegistry.ts` (novo): tabela COMPE/ISPB → nome, apelidos e regex de detecção.
- `src/lib/bankDetect.ts` (novo): cascata de detecção sobre texto do OFX/PDF.
- `src/lib/pdfStatementParser.ts`: extrair itens com x/y, detecção de cabeçalho, mapeamento de colunas, agrupamento de linhas, fallback para o parser atual.
- `src/components/AccountKeyDialog.tsx`: mostrar banco detectado com a origem (código, nome ou logo) e botão opcional "Identificar pela logo".
- Detecção pela logo: nova Edge Function usando o modelo de visão do Lovable AI (sem chave extra), acionada só sob demanda.
- `src/lib/accountHolder.ts` (novo): extração de nome/CPF/CNPJ e comparação com contas já cadastradas.
- Backend: nova tabela de contas (apelido, agência, conta, banco, titular, documento) com RLS por usuário e GRANTs; `bank_statements` ganha referência à conta.
- Testes unitários em `src/lib/` cobrindo detecção de banco, titular/documento e mapeamento de colunas com amostras de layouts diferentes.