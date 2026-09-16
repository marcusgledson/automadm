# Central de Alertas no painel + envio por e-mail

## O que você vai ver

Um bloco novo "Alertas e pendências" no topo do painel inicial, acima dos módulos, com um cartão para cada pendência e um botão que leva direto à tela onde ela se resolve.

Tipos de alerta reunidos:

1. **Metas** — metas com custo real acima do orçado ou no percentual de alerta. Botão: "Ver metas".
2. **Validações pendentes** — mensagens de banco (SMS) aguardando revisão. Botão: "Revisar".
3. **Importações** — contas de consumo com vencimento nos próximos 7 dias ou já vencidas sem pagamento registrado, e importações do mês sem valor lido (campos vazios que precisam de conferência). Botão: "Abrir Central de Contas" / "Abrir Extrato".
4. **Solicitações** — pedidos de acesso e de relatório pendentes (só para quem administra). Botão: "Abrir solicitações".

Cada cartão mostra contagem, cor conforme gravidade (vermelho estourado, âmbar em alerta, neutro informativo) e some quando não há nada pendente. O bloco inteiro só aparece se houver ao menos um alerta, e respeita os módulos liberados para o usuário.

## Envio por e-mail

Hoje o domínio remetente **notify.gsconsultinfo.com não está mais registrado** no projeto — ele foi removido durante a configuração anterior, então nenhum e-mail sai. O primeiro passo é refazer o cadastro do domínio; sem isso o envio não funciona.

Depois do domínio ativo:

- Criação da infraestrutura de envio (fila, registro de envios, cancelamento de inscrição).
- Três modelos de e-mail com a identidade Verde Oliva do app:
  - **Meta estourada** — título da meta, valor orçado, valor realizado, quanto passou.
  - **Confirmação de importação** — arquivo, módulo, quantidade de registros salvos, ignorados por duplicidade e com erro.
  - **Validação pendente** — resumo do que precisa de conferência (senha de PDF, boleto sem campo lido, SMS na fila).
- Disparo real: a confirmação de importação sai ao final de cada importação concluída; o alerta de meta sai quando a meta cruza o limite (uma vez por meta e mês, sem repetição); a validação sai quando algo entra na fila de revisão.
- Todos vão para o e-mail cadastrado do próprio usuário, um envio por evento, com chave de idempotência para não duplicar.
- Uma página de cancelamento de inscrição no app, exigida pelo rodapé dos e-mails.

## Detalhes técnicos

- Novo hook `useAlerts` agrega em paralelo: `budget_goals` (via `useBudgetGoals.progress`), `sms_review_queue` pendentes, `consumption_bills` por vencimento, `org_access_requests` e `report_requests` pendentes. Filtra por `useModuleAccess`.
- Novo componente `src/components/AlertsPanel.tsx` no padrão de `Card`/`Badge` já usado, montado em `src/pages/Dashboard.tsx` acima do grid de módulos.
- Coluna de controle de envio para metas (evita reenvio) gravada em `budget_goals` ou tabela auxiliar de notificações.
- Modelos React Email em `supabase/functions/_shared/transactional-email-templates/`, envio via a função `send-transactional-email`, disparada dos pontos de importação e da atualização de metas.

## Primeiro passo

Configurar o domínio remetente antes de eu ligar os envios.
