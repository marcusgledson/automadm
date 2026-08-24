# Leitura de extrato em PDF + verificação de dependências SheetJS

## 1. Dependências SheetJS (já verificado)

O `package.json`, o `bun.lock` e o `package-lock.json` apontam apenas para `xlsx` na versão oficial `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Não há nenhum outro pacote derivado do SheetJS no projeto (nada de `node-xlsx`, `xlsx-style`, `read-excel-file`, `exceljs`, nem cópia antiga 0.18.5 em transitivas). Nenhuma atualização adicional é necessária; a etapa do plano é apenas rodar o scanner de dependências novamente para registrar o resultado.

## 2. Por que o PDF não carrega

O leitor atual (`src/lib/pdfStatementParser.ts`) trabalha em duas estratégias:

- **Colunas**: só é usada se encontrar, nas primeiras 120 linhas, uma linha de cabeçalho com célula "Data" + uma célula de valor ("Valor"/"Débito"/"Crédito") e pelo menos 3 rótulos reconhecidos, cada rótulo em uma célula separada.
- **Linhas (fallback)**: exige que a linha *comece* com data `dd/mm` e *termine* com valor no formato brasileiro.

Ambos os caminhos falham em layouts muito comuns:

- cabeçalho quebrado em duas linhas ("Data" / "Mov.") ou rótulos colados numa única célula ("Data Histórico Valor Saldo");
- extratos sem cabeçalho, com data no meio da linha ou data por bloco (a data aparece uma vez e vale para várias linhas seguintes);
- linhas que terminam com o **saldo** em vez do valor do lançamento (o fallback captura o saldo como valor);
- valores com `R$`, sinal depois do número, ou coluna D/C separada por espaços;
- PDF digitalizado (imagem), onde não há camada de texto alguma — nesse caso nenhum parser resolve sem OCR.

Sem ver o arquivo, não dá para afirmar qual desses casos é o seu. Por isso o primeiro passo é diagnóstico com o arquivo real.

## 3. Passos propostos

1. **Você envia um extrato de teste** (pode ser com valores/nome mascarados, mas mantendo o layout e o cabeçalho originais).
2. **Diagnóstico**: extrair o layout do arquivo (linhas, células e coordenadas) e verificar exatamente onde o reconhecimento para: sem camada de texto, cabeçalho não detectado, colunas mal delimitadas ou linhas descartadas.
3. **Correção dirigida ao caso real**, entre estas frentes:
   - ampliar o dicionário de rótulos e aceitar cabeçalho em múltiplas linhas ou em célula única;
   - detectar colunas por agrupamento das coordenadas x dos próprios lançamentos quando não houver cabeçalho;
   - herdar a data do bloco anterior quando a linha não repete a data;
   - distinguir valor x saldo quando há dois números na linha (o último geralmente é saldo acumulado);
   - aceitar `R$`, sinal posposto e marcador D/C isolado.
4. **Modo diagnóstico na tela**: quando o PDF for lido e resultar em 0 lançamentos, exibir um aviso com o motivo provável (PDF sem texto / cabeçalho não reconhecido) e um botão para ver as primeiras linhas extraídas, em vez do erro genérico atual.
5. **Testes unitários** em `src/lib/pdfColumns.test.ts` com o layout do arquivo enviado (anonimizado), garantindo que os lançamentos passem a ser reconhecidos sem quebrar os formatos que já funcionam.

## Detalhes técnicos

- `src/lib/pdfStatementParser.ts`: `detectColumns` (cabeçalho tolerante e fallback por clusterização de x), `parseByColumns` (data herdada, saldo vs valor), `parseByLines` (regex mais permissiva).
- `src/pages/Index.tsx`: tratamento do resultado com 0 registros, com painel de diagnóstico em vez de toast genérico.
- Sem mudanças de backend; a leitura do PDF continua 100% no cliente.
