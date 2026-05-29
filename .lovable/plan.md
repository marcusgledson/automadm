# Plano de Evolução

## 1. Visual moderno + PWA mobile

- Refinar `index.css` / `tailwind.config.ts` com gradientes suaves, sombras elegantes, tipografia mais leve e espaçamento mais arejado.
- Tornar **Dashboard**, **Central de Contas e Despesas**, **Neoenergia** e **Analytics** totalmente responsivos (cards empilháveis, header colapsando ações em menu, tabelas com scroll horizontal + cartões em mobile).
- Adicionar suporte **PWA instalável** (manifest + ícones + meta tags). Sem service worker / cache (evita travar preview do Lovable). Aviso: instalação só funciona no app publicado.

## 2. Renomear & unificar

- Renomear "Central de Contas" → **"Central de Contas e Despesas"** em rotas, dashboard e títulos.
- Integrar Faturas Neoenergia ao mesmo cadastro: faturas Neoenergia já gravam em `consumption_bills` (tipo `energia`); manter o módulo Neoenergia como **importador especializado** e fazer a Central listar tudo unificadamente, incluindo um filtro "Origem" (Neoenergia / Upload / Manual / OFX).

## 3. Persistência do Extrato OFX

Nova tabela `bank_statements`:

```text
user_id, agencia, conta, data, lancamento, descricao,
valor, tipo, tipo_lancamento, categoria, documento,
codigo_operacao, fitid, raw jsonb, created_at, updated_at
```

- Chave única: `(user_id, agencia, conta, fitid)` para evitar duplicidade real de transação (FITID é o ID único OFX).
- Operação **UPSERT**: novas linhas inseridas; existentes recebem UPDATE dos campos atualizados.
- Header do OFX (`<BANKACCTFROM>`) extraído para capturar **Agência (BRANCHID) + Conta (ACCTID)** e exibido no topo da tela de Extrato.
- Tela `/extrato` ganha botão **"Salvar na Base"** + listagem dos extratos salvos com filtro por Agência/Conta.

## 4. Gravar Despesas (Débitos) na Central

Nova tabela `expenses`:

```text
user_id, tipo_lancamento, categoria, numero_documento,
detalhes, valor, data_vencimento, data_pagamento, origem
```

- Ao salvar o OFX, transações com `tipo = Débito` viram registros automáticos em `expenses` (origem `ofx`).
- Na Central de Contas e Despesas, nova aba **"Despesas"** com:
  - **Toggle**: "📎 Carregar arquivo" ou "✍️ Lançar manualmente".
  - Modo arquivo → upload PDF/OFX (reaproveita `UniversalBillUpload` + parser OFX).
  - Modo manual → formulário com os campos pedidos (Tipo, Categoria, Nº Documento, Detalhes, Valor, Vencimento, Pagamento).
- Lista ordenada por vencimento crescente, filtros (tipo, categoria, período), edição/exclusão.

## 5. Detalhes técnicos

- 2 migrations: `bank_statements` e `expenses` com RLS por `auth.uid()` e GRANTs.
- Novo hook `useBankStatements` (upsert por FITID) e `useExpenses` (CRUD).
- Atualizar `fileParser.ts` para extrair `BRANCHID` e `ACCTID` do header OFX.
- Reaproveitar mapeamento existente para classificar categoria automaticamente nas despesas vindas do OFX.
- Manter Faturas Neoenergia funcionando exatamente como hoje, apenas refletindo na Central unificada.

## Arquivos principais
- **Migrations:** `bank_statements`, `expenses`
- **Criados:** `src/hooks/useBankStatements.ts`, `src/hooks/useExpenses.ts`, `src/components/ExpenseForm.tsx`, `src/pages/ContasDespesas.tsx` (substitui ContasCentral), `public/manifest.json`, `public/icon-*.png`
- **Editados:** `src/lib/fileParser.ts`, `src/pages/Index.tsx` (Extrato), `src/pages/Dashboard.tsx`, `src/App.tsx`, `index.html`, `src/index.css`, `tailwind.config.ts`

Confirma para eu seguir? Se quiser priorizar parte (ex: só visual+PWA primeiro, ou só persistência), me diga.