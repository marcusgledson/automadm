# Extrato em PDF: memória de layout, confiança por lançamento e importação em lote

Três evoluções na Análise de Extrato Bancário, mantendo o fluxo atual de pré-visualização antes de confirmar.

## 1. Memória de mapeamento por banco

- Quando você corrigir as colunas no preview e confirmar a importação, o mapeamento é salvo vinculado ao banco identificado (código COMPE ou nome) e à "assinatura" do cabeçalho do extrato.
- No próximo PDF do mesmo banco/layout, o mapeamento salvo é aplicado automaticamente: o preview já abre corrigido, com um aviso "mapeamento salvo aplicado" e a opção de descartar/atualizar.
- Cada usuário tem seus próprios perfis salvos; é possível remover um perfil pelo próprio aviso no preview.

Nova tabela `pdf_column_profiles`: usuário, banco (código e nome), assinatura do cabeçalho, mapeamento das colunas, estratégia de leitura, contador de uso e data do último uso. Acesso restrito ao dono do registro.

## 2. Indicador de confiança por lançamento

Cada lançamento reconhecido recebe uma pontuação de confiança calculada na leitura, considerando:

- data válida e coerente com o período do extrato;
- valor numérico bem formado e sinal (débito/crédito) determinado com clareza;
- descrição não vazia e não fragmentada;
- linha herdando data de bloco anterior ou com colunas fora do alinhamento esperado.

No preview:

- badge por linha (alta / média / baixa) com a razão da dúvida no tooltip;
- linhas ambíguas destacadas e agrupadas no topo, com filtro "mostrar só ambíguos";
- contador "N lançamentos precisam de revisão" no cabeçalho do diálogo;
- os campos data, descrição e valor das linhas ambíguas ficam editáveis ali mesmo antes de confirmar.

## 3. Importação em lote de vários PDFs

- O seletor de arquivos passa a aceitar múltiplos PDFs (arrastar vários também).
- Fila de processamento sequencial com barra de progresso, nome do arquivo atual e opção de cancelar; senha é solicitada por arquivo protegido, e um arquivo que falha não interrompe os demais.
- Um preview consolidado lista os arquivos com banco/conta/período/quantidade detectados; é possível desmarcar arquivos antes de confirmar.
- Deduplicação em duas camadas:
  - dentro do próprio lote, removendo lançamentos idênticos entre arquivos sobrepostos (mesma conta, data, valor, descrição/documento);
  - contra a base, reaproveitando a verificação por chave já existente (agência + conta + identificador do lançamento), mostrando quantos já existem e serão ignorados/atualizados.
- Resumo final por arquivo: importados, duplicados ignorados, com erro.

## Detalhes técnicos

- `src/lib/pdfStatementParser.ts`: expor `confidence` e `flags` por registro em `parseByColumns`/`parseByBlocks`; helper de assinatura de cabeçalho (`headerSignature`) para casar perfis salvos.
- Novo `src/hooks/usePdfColumnProfiles.ts`: buscar/salvar/remover perfis, com match por código do banco + assinatura.
- `src/components/PdfPreviewDialog.tsx`: coluna de confiança, filtro de ambíguos, edição inline das linhas duvidosas, aviso de perfil aplicado.
- Novo `src/components/PdfBatchImportDialog.tsx` + fila em `src/pages/Index.tsx` (`AbortController`, processamento sequencial).
- `src/components/FileUploader.tsx`: `multiple`, mantendo as validações de tamanho, magic bytes e rate limiting já existentes.
- `src/hooks/useBankStatements.ts`: `checkExisting` recebendo lotes multi-conta e dedupe intra-lote antes do upsert.
- Testes em `src/lib/pdfColumns.test.ts` para scoring de confiança e dedupe.
