## Visão Geral

Vou transformar o módulo Neoenergia em uma **Central de Contas de Consumo** completa, com base de dados persistente no Lovable Cloud, suporte a múltiplos tipos de contas (Energia, Internet, Água, IPTU, IPVA, Taxas, etc.), validação de duplicidade, filtros avançados e análises/projeções enriquecidas com IA + pesquisa Google.

---

## 1. Base de dados (Lovable Cloud)

Criar tabela `consumption_bills` para persistir todas as faturas (importadas via Drive ou Upload):

```text
consumption_bills
├── id, user_id
├── tipo_conta         (energia | internet | agua | iptu | ipva | taxa | outro)
├── fornecedor         (Neoenergia, Vivo, Sabesp, Prefeitura...)
├── codigo_instalacao  (chave principal — ou número do contrato/matrícula)
├── titular, cpf_cnpj, endereco
├── mes_referencia     (YYYY-MM padronizado)
├── data_vencimento    (date)
├── valor_total
├── consumo_kwh / consumo_m3 / consumo (genérico)
├── impostos_json      (icms, pis, cofins, iss, etc.)
├── itens_json         (itens da fatura)
├── historico_json     (histórico de consumo quando disponível)
├── raw_data           (dump completo da IA)
├── file_name, source  (drive | upload)
└── created_at, updated_at
```

- **RLS**: cada usuário enxerga apenas suas próprias faturas.
- **Índice único**: `(user_id, codigo_instalacao, data_vencimento)` → garante duplicidade zero.

---

## 2. Validação de duplicidade

Regra única para Drive **e** Upload:
- Chave = `codigo_instalacao + data_vencimento`
- Se já existe → toast/erro: **"Fatura com Código Instalação e Data Vencimento já carregados na Base"**
- Vale para qualquer tipo de conta (não só Neoenergia)

---

## 3. Importação universal (multi-conta)

Novo componente `UniversalBillUpload`:
- Aceita PDF de qualquer fornecedor (Energia / Internet / Água / IPTU / IPVA / Taxas)
- Usuário escolhe o **tipo de conta** antes de subir
- Edge function `parse-bill` usa Lovable AI (Gemini) com prompt adaptado ao tipo
- Mesma validação de duplicidade da importação via Drive

Drive import continua funcionando, agora gravando no banco em vez de só `localStorage`.

---

## 4. Nova tela: Central de Contas (`/contas`)

Padrão visual idêntico ao **Análise de Extrato**:
- Tabela ordenada por **data de vencimento crescente**
- Filtros: Código Instalação · Mês Referência · Tipo de Conta · Fornecedor · Período
- Busca textual (titular, endereço)
- Badges por tipo de conta com cores semânticas
- Ações por linha: ver detalhe, excluir, exportar
- Export XLSX/CSV reutilizando `exportXlsx.ts`

---

## 5. Análises & Projeções evoluídas

Nova aba **"Análises & Projeções"** em `NeoenergiaAnalytics` (renomeado para "Análises de Consumo"):

**a) Média histórica (até 5 anos)**
- Slider: 1 → 5 anos de janela
- Média mensal, anual, por tipo de conta
- Comparativo ano-a-ano com variação %

**b) Projeção 12 meses**
- Baseado em média + tendência (regressão linear simples)
- Considera inflação setorial estimada

**c) Impostos por ano (com pesquisa Google via IA)**
- Edge function `tax-research` que chama Lovable AI (Gemini 2.5 Pro com Google grounding) para buscar:
  - Carga tributária média de energia/água/internet no Brasil por ano
  - ICMS, PIS, COFINS, ISS aplicáveis
- Resultado mostrado em card com fonte e ano
- Cache local (24h) para evitar chamadas repetidas

**d) Cenário "What-if"**
- Inputs: aumento tarifa %, mudança de consumo %
- Recalcula projeção dinamicamente

---

## 6. Detalhes técnicos

- **Migration** criando tabela + RLS + índice único
- **Edge functions** novas: `parse-bill` (genérico) e `tax-research`
- **Edge function existente** `download-drive-file` adaptada para gravar no banco
- **Hook** `useConsumptionBills` para CRUD + realtime
- **Auth obrigatória** já existe no projeto

---

## 7. Ordem de implementação

1. Migration da tabela `consumption_bills`
2. Hook `useConsumptionBills` + tipos
3. Adaptar Drive import para gravar no banco com validação
4. Componente `UniversalBillUpload` + edge `parse-bill`
5. Nova página `/contas` (Central de Contas) com filtros
6. Evoluir analytics: médias até 5 anos + projeção + cenário
7. Edge `tax-research` + card de impostos por ano
8. Link no Dashboard para a nova Central

---

Quer que eu siga com **tudo de uma vez**, ou prefere que eu **divida em fases** (ex.: começar pela base de dados + duplicidade e depois a Central + análises)?