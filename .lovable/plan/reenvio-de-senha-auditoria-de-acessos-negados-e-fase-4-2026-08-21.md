# Reenvio de senha, auditoria de acessos negados e Fase 4

## 1. Troca obrigatória de senha: expiração + reenvio

Hoje a tela de primeiro acesso apenas confere o e-mail cadastrado e grava a nova senha, sem qualquer prazo de validade nem forma de reenviar a credencial.

O que muda:
- A senha padrão passa a ter validade (72 horas a partir da criação/redefinição). A tela mostra o prazo restante.
- Se o prazo expirou, o formulário é bloqueado e só aparece o botão **Reenviar acesso por e-mail**, que dispara um e-mail de redefinição para o e-mail cadastrado na conta (nunca para outro e-mail digitado).
- O botão de reenvio também fica disponível antes de expirar, com espera de 60 segundos entre envios para evitar abuso.
- Após o reenvio, um novo prazo de 72 horas é gravado.
- Cada reenvio, expiração detectada e troca concluída entra na auditoria.

## 2. Auditoria de acessos negados

Toda vez que um usuário tentar abrir um módulo sem permissão — pela rota (tela "Acesso não liberado") ou clicando em um card bloqueado do painel — o sistema registra na auditoria: quem tentou, qual módulo, por qual caminho (rota ou card) e o motivo da negação (bloqueado pela organização, pelo perfil ou pelo usuário).

Para não poluir o histórico, a mesma tentativa (mesmo usuário + módulo + motivo) é registrada no máximo uma vez a cada 30 minutos.

A tela Perfis e Usuários passa a exibir esses registros com o rótulo "Acesso negado", e o Máster pode filtrar o histórico por tipo de ação.

## 3. Próximas fases

**Fase 4 — Solicitações e relatórios**
- Tela de solicitação de relatório para Colaborador/Leitor (módulo, formato, justificativa), gravando em `report_requests`.
- Caixa de aprovação para o Máster (aprovar/recusar, com data e responsável), com auditoria de cada decisão.
- Tela de demanda corporativa (`corporate_requests`) para pedidos de novos módulos, disponível conforme o modo de uso da organização.

**Fase 5 — Relatórios e exportações por perfil**
- Exportações do Menu Gerencial passam a respeitar o perfil: Leitor não exporta; Colaborador exporta apenas após aprovação registrada.

Fase 4 é implementada nesta entrega; Fase 5 fica para a próxima, salvo pedido contrário.

## Detalhes técnicos

Banco:
- `profiles`: colunas `temp_password_expires_at timestamptz` e `password_email_sent_at timestamptz`. Preenchidas na criação/redefinição de senha pela função `manage-org-users`.
- Função `public.log_access_denied(_module text, _surface text, _reason text)` (SECURITY DEFINER) inserindo em `audit_logs` com `action = 'access_denied'`, resolvendo `org_owner_id` via `org_owner_of(auth.uid())` e aplicando a dedupe de 30 min; `GRANT EXECUTE` para `authenticated`.
- Sem novas tabelas para a Fase 4 (as tabelas `report_requests` e `corporate_requests` já existem); apenas revisão das políticas de leitura/decisão.

Edge Function `manage-org-users`:
- Novas ações `resend_access_email` (auto-serviço do próprio usuário; usa `generateLink` do Admin API para o e-mail cadastrado, grava novo `temp_password_expires_at`, log `resend_access_email`) e gravação do prazo nas ações `create` e `reset_password`.

Front:
- `ForcePasswordChange.tsx`: contagem regressiva, estado expirado, botão de reenvio com cooldown.
- `useModuleAccess.ts`: expor `denialReason(moduleId)` (`org` | `role` | `user`) e helper `logDenied`.
- `ModuleGuard.tsx` e `Dashboard.tsx`: chamar o log ao bloquear rota / clicar em card bloqueado.
- `useAuditLogs.ts`: rótulos `access_denied`, `resend_access_email`, `temp_password_expired` e filtro por ação na lista.
- Fase 4: `src/pages/Solicitacoes.tsx` + hook `useReportRequests.ts`, rota registrada em `App.tsx` e entrada no `UserMenu`.

## 4. Aparência configurável no Painel Gerencial

Nova aba **Aparência** no Menu Gerencial (disponível ao Máster para toda a organização; demais perfis apenas visualizam), permitindo trocar a qualquer momento o que hoje só é escolhido no onboarding:

- **Paleta de cores**: opções pré-definidas (Verde Oliva como padrão atual, além de Azul, Grafite, Terracota, Roxo e Areia), com pré-visualização das amostras.
- **Logo da tela inicial**: enviar/definir a imagem exibida no painel, com opção de voltar ao padrão.
- **Tema/estilo de aparência**: Escritório, Construção, Arquitetura, Meio Ambiente, Carros, Aviação e Neutro. Cada tema ajusta imagem de fundo/ilustração, ícones de destaque e textura dos cards, sempre respeitando a paleta escolhida (o Neutro usa apenas a paleta, sem imagem temática).

As mudanças valem imediatamente para toda a aplicação (painel, módulos e telas de acesso) e ficam salvas na organização, sem precisar refazer o onboarding.

Detalhes técnicos: reaproveita as colunas já existentes `palette`, `theme_style` e `logo_url` em `app_settings`; novo componente `src/components/AppearancePanel.tsx` usado pelo `AdminPanel`, com as mesmas listas de paletas/temas hoje declaradas em `Onboarding.tsx` extraídas para `src/lib/appearance.ts`. As paletas gravam variáveis HSL em `index.css` (tokens `--primary`, `--accent`, etc.) aplicadas em runtime por um provider de tema; nenhuma cor fixa em componentes.
