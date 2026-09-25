# Robô de testes completo (nos bastidores) + relatório compilado

Nada novo aparece no app. Eu rodo o robô aqui e entrego o relatório em PDF (Verde Oliva), XLSX e JSON em Arquivos.

## Antes de começar: arquivos que você precisa enviar
Para esgotar as falhas de importação, envie (pode ser anonimizado):
1. **OFX**: 1 de conta corrente, 1 de cartão de crédito, 1 com várias contas, 1 de cada banco que usa (BB, Caixa, Itaú, Bradesco, Santander, Nubank, Inter...).
2. **Extrato PDF**: 1 sem senha, 1 com senha (e a senha), 1 escaneado (imagem), 1 de banco diferente.
3. **Fatura Neoenergia PDF**: 1 normal, 1 com senha, 1 de mês com religação/multa, mesma fatura duas vezes (teste de duplicidade).
4. **Outras contas**: água, internet, gás, IPTU (1 de cada, se tiver).
5. **Investimentos**: 1 nota/extrato de corretora ou banco em PDF.
6. **SMS**: 5 a 10 mensagens de banco copiadas (débito, crédito, Pix).
7. **Link de pasta pública do Google Drive** com alguns desses arquivos (e um link de OneDrive, se usar).

Arquivos inválidos (vazio, corrompido, extensão trocada, gigante, PDF com script) o robô gera sozinho.

## O que o robô testa
1. **Importação** — cada arquivo acima + arquivos inválidos gerados; senha certa/errada; reimportação sem duplicar; conferência dos valores lidos.
2. **Chaves e amarração das tabelas** — duplicidade nas chaves naturais (faturas, extratos, investimentos, links), registros órfãos, vínculos entre conta bancária/extrato, organização/perfil/papel.
3. **Segurança** — acesso sem login a cada tabela e função, usuário lendo/alterando dado de outro, tentativa de se promover a Master, envio de arquivo malicioso, varredura automática de segurança.
4. **Interação entre usuários** — contas de teste temporárias Master, Operador, Leitor e Colaborador de uma empresa de teste: pedido de acesso, aprovação/recusa, permissão por módulo, empresa bloqueada, pedidos de relatório.
5. **Amarração de módulos e processos** — navegação por todas as telas com cada perfil, alertas do painel batendo com os dados, metas, fila de SMS, exclusões com impacto.
6. **Exportação** — relatórios PDF/XLSX/CSV/JSON de cada módulo, conferindo se abrem e se respeitam o que cada perfil pode ver.
7. **Erros capturados** — erros de tela e de servidor registrados durante toda a rodada; testes automáticos já existentes.

## Dados de teste
Tudo o que o robô cria é marcado como teste (contas `robo-*@teste`, empresa de teste) e apagado ao final, com conferência de que nada ficou para trás.

## Relatório final
- Resumo: total de testes, aprovados, falhas por gravidade (crítica/alta/média/baixa).
- Uma seção por categoria: teste, resultado, evidência, causa provável e recomendação.
- Arquivos: `relatorio-testes.pdf`, `relatorio-testes.xlsx`, `relatorio-testes.json`.
- Nada é corrigido automaticamente; depois você escolhe o que corrigir.

## Detalhes técnicos
- Scripts em /tmp: Vitest (testes existentes), Playwright contra localhost:8080 com sessões geradas por perfil, chamadas diretas às funções do servidor e à API de dados com tokens de cada perfil e sem token (anon).
- Contas de teste criadas pela função manage-org-users; limpeza por consultas marcadas por e-mail/organização de teste.
- Consultas de integridade (duplicidade por chave natural, FKs órfãs) via leitura do banco; linter e scanner de segurança.
- Relatório gerado com reportlab (DejaVu Sans), openpyxl e JSON; revisão visual de todas as páginas do PDF.
