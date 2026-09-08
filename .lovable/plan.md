# Consulta da base do Extrato, links por módulo e mapa das tabelas

## 1. "Consultar base" vira aba dentro do Extrato Financeiro

A janela pop-up atual sai de cena. O Extrato passa a ter duas abas:

- **Analisar arquivo** — o que já existe hoje (importar, conferir, salvar).
- **Consultar base** — os lançamentos já gravados, com o mesmo visual da análise.

A aba de consulta segue exatamente o padrão da tela de análise:

- **Cabeçalho da conta**: instituição bancária, agência/conta, titular e documento do titular do conjunto filtrado.
- **Filtros no topo**: banco, agência/conta, titular, tipo de lançamento, categoria, período (de/até) e busca livre na descrição.
- **Tabela**: mesmas colunas e ordenação por clique do cabeçalho (data, lançamento, descrição, documento, tipo, categoria, valor), com rolagem horizontal.
- **Totais**: quantidade de lançamentos, total de créditos, total de débitos e saldo do período, com o mesmo estilo de cartões/etiquetas.
- **Exportar** (planilha/CSV) e o painel de destino já existente: salvar no dispositivo, Google Drive ou OneDrive.

## 2. Base de dados dos extratos importados

Os lançamentos importados já são gravados; o que falta é garantir o conjunto completo de identificação para a consulta:

- Gravar sempre banco (nome e código), agência, conta, titular e documento do titular junto de cada lançamento.
- Preencher esses campos também nos lançamentos antigos que ficaram sem titular/documento, a partir da conta cadastrada correspondente.
- Índices para as consultas por banco, conta e titular ficarem rápidas.
- A chave antiduplicidade continua a mesma: usuário + agência + conta + identificador do lançamento.

## 3. Links do Google Drive por módulo e tipo de arquivo

Hoje todos os módulos enxergam a mesma lista de links. Passa a ser:

- Cada link guarda o **módulo** (Extrato, Contas e Despesas, Investimentos) e o **tipo de arquivo** (OFX, PDF, planilha).
- Cada tela mostra e salva apenas os links do seu módulo e do tipo que ela importa.
- Os links já cadastrados são atribuídos ao módulo **Extrato**, como você pediu.
- Não é possível repetir o mesmo link dentro do mesmo módulo/tipo.

## 4. Relacionamento das tabelas por módulo

```text
CADASTRO / ACESSO
  organizations ──< profiles >── auth user
  organizations ──< user_roles              (perfil: máster, operador, colaborador, leitor)
  organizations ──< org_access_requests     (pedidos de entrada na empresa)
  role_modules                              (módulos liberados por perfil)
  audit_logs / upload_audit_logs            (registro de ações e de envios)
  app_settings                              (modo de uso, tema, módulos ativos)

EXTRATO FINANCEIRO
  bank_accounts ──< bank_statements         (conta cadastrada -> lançamentos)
  bank_statements >── expenses              (débitos viram despesas, via referência de origem)
  pdf_column_profiles                       (memória de layout de extrato em PDF)
  drive_links (módulo: extrato, tipo: OFX/PDF)

CONTAS E DESPESAS
  consumption_bills                         (faturas de energia, água, internet, tributos)
  expenses                                  (despesas manuais + originadas de extrato/faturas)
  budget_goals                              (metas e alertas de custo)
  drive_links (módulo: contas, tipo: PDF)

INVESTIMENTOS
  investments                               (manual, upload ou Drive)
  drive_links (módulo: investimentos, tipo: PDF/planilha)

SMS
  sms_bank_configs ──< sms_review_queue     (configuração do banco -> fila de revisão)

RELATÓRIOS
  report_requests, corporate_requests       (pedidos e liberações)
```

Ligações principais: tudo é isolado por usuário e, quando corporativo, pelo dono da organização. `bank_accounts.id` liga a conta cadastrada aos lançamentos; `expenses.source_ref` liga a despesa ao lançamento de origem; `consumption_bills` não duplica pela combinação instalação + vencimento; `investments` não duplica por instituição + ativo + data de aplicação.

## Detalhes técnicos

- `src/pages/Index.tsx`: envolver o conteúdo em `Tabs` ("Analisar arquivo" / "Consultar base"); remover a montagem de `SavedStatementsDialog` e o botão que o abria.
- Novo `src/components/SavedStatementsTable.tsx`: extraído de `SavedStatementsDialog.tsx` (que será removido), reaproveitando o layout de `DataTable.tsx` (filtros, ordenação, totais, export) sobre `BankStatementRow`, mais cabeçalho de conta/instituição/titular e `SaveDestinationPanel`.
- `useBankStatements.ts`: expor `titular`/`documento_titular` no tipo `BankStatementRow` e incluí-los no `select`.
- Migração: índices em `bank_statements (user_id, banco)`, `(user_id, agencia, conta)`, `(user_id, titular)`; `banco_codigo text` em `bank_statements`; backfill de `titular`/`documento_titular` a partir de `bank_accounts` via `account_id`.
- Migração `drive_links`: colunas `module text not null default 'extrato'` e `file_kind text not null default 'ofx'`, troca do índice único para `(user_id, module, file_kind, url)`, GRANTs mantidos.
- `useDriveLinks.ts`: passar a receber `{ module, fileKind }` e filtrar/gravar por eles; atualizar chamadas em `GoogleDriveImport.tsx` (contas), `GoogleDriveOFXImport.tsx` (extrato) e no módulo de investimentos.
