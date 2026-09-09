# Corrigir erro "ON CONFLICT DO UPDATE cannot affect row a second time" no Extrato

## Diagnóstico (confirmado no código)

A gravação do extrato (`src/hooks/useBankStatements.ts`, `upsertMany`) usa a chave antiduplicidade **usuário + agência + conta + fitid**. O `fitid` é montado assim:

```text
fitid = r.fitid || r.documento || `${data}|${valor}|${descricao}`
```

O erro acontece quando **duas linhas do mesmo arquivo geram o mesmo fitid dentro do mesmo envio**. O Postgres não aceita atualizar a mesma linha duas vezes num único UPSERT e aborta toda a gravação. Situações que disparam isso:

- Arquivo OFX com `FITID` ausente ou repetido (alguns bancos reutilizam).
- PDF onde duas linhas têm o mesmo número de documento (ex.: tarifa pacote, débito automático repetido no mês).
- Sem fitid nem documento: dois lançamentos legítimos com mesma data, valor e descrição (ex.: dois pagamentos idênticos no mesmo dia) caem no mesmo fallback.

A deduplicação existente (`dedupeRecords` na tela) usa outra chave (data|valor|documento|descrição normalizada), então **não protege** a chave real do conflito.

## Correção

1. **`useBankStatements.ts` — tornar o fitid único dentro do lote, sem perder lançamentos:**
   - Antes de montar o payload, calcular o fitid-base de cada linha com a regra atual.
   - Para repetições do mesmo fitid-base no mesmo arquivo, acrescentar um sufixo estável por ocorrência: `#2`, `#3`... (ex.: `2025-01-03|-25.00|Padaria#2`).
   - Como o sufixo depende apenas da ordem no arquivo, uma **reimportação do mesmo arquivo gera as mesmas chaves** e continua atualizando em vez de duplicar — a antiduplicidade segue funcionando.
   - Nenhum lançamento é descartado (deduplicar de verdade apagaria transações idênticas legítimas).

2. **`checkExisting`** passa a usar a mesma geração de chaves (extraída para uma função única, ex.: `buildFitids(records)`), para que a contagem "já existem na base" bata com o que será gravado.

3. **Resumo da importação** (Index.tsx) segue inalterado; o erro deixa de aparecer e o toast de sucesso mostra a contagem real.

## Detalhes técnicos

- Nova função pura em `src/hooks/useBankStatements.ts` (ou `src/lib/`): recebe `FinancialRecord[]`, devolve array de fitids com sufixos de ocorrência; usada por `recordToRow` (via contexto do lote), `upsertMany` e `checkExisting`.
- Implementação: um `Map<string, number>` de contagem por fitid-base; primeira ocorrência sem sufixo, demais com `#n`.
- Sem mudança de schema nem de dados já gravados — linhas antigas com o fitid antigo continuam casando na reimportação (primeira ocorrência não muda).
- Validação: `npx tsgo --noEmit` e teste de unidade da geração de chaves (casos: sem colisão, colisão dupla, reimportação estável).
