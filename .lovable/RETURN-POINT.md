# PONTO RETURN — marco de restauração

**Criado em:** 2026-08-20
**Commit base (estado congelado):** `c56a344` — "Fixou voltar e menu início"

Este é o marco solicitado pelo usuário. Tudo que for desenvolvido a partir daqui
(modos de uso, perfis/usuários, metas, temas, demandas corporativas) pertence à
fase "Evolução Corporativa" e pode ser revertido em bloco.

## O que existia neste ponto (estado congelado)

- Dashboard com 3 módulos: Extrato Bancário, Central de Contas e Despesas, Investimentos.
- Módulo avançado Faturas de Energia (`/neoenergia`) + Análises (`/neoenergia/analytics`).
- Leitura de SMS bancário (`/sms/config`, `/sms/revisao`).
- Segurança local: PIN, biometria, lockout, auto-lock, login por PIN.
- Menu Gerencial: backup JSON/Drive criptografado, exclusão com análise de impacto.
- FAQ, HelpDialog/manual PDF.
- Tabelas: profiles, bank_statements, expenses, consumption_bills, investments,
  drive_links, sms_bank_configs, sms_review_queue.

## Como voltar a este ponto

1. Código: reverter para o commit `c56a344` (histórico do projeto / "Reverter" no
   painel de versões do Lovable, escolhendo a versão "Fixou voltar e menu início").
2. Banco: as tabelas/tipos criados depois deste marco são, nesta ordem:
   `report_requests`, `corporate_requests`, `budget_goals`, `app_settings`,
   `user_roles`; funções `has_role`, `org_owner_of`, `is_master`, `is_app_owner`;
   tipos `app_usage_mode`, `app_role`, `user_gender`, `goal_status`, `request_status`;
   colunas extras em `profiles` (`full_name`, `gender`, `phone_*`,
   `must_change_password`, `org_owner_id`, `allowed_modules`).
   Basta remover esses objetos para restaurar o esquema original.

> Não apagar este arquivo: ele é a referência do rollback.
