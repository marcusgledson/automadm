---
name: rapaduramanbr
description: RapaduraManBr — robô de testes complexos. Use quando o usuário pedir "RapaduraManBr", "robô de testes", varredura/QA completa ou monitoramento de uma aplicação. Executa testes supervisionados e exporta relatório PDF/XLSX/JSON.
---

# RapaduraManBr — robô de testes supervisionado

Atua em qualquer projeto do usuário, somente quando solicitado, sempre em modo supervisionado: nunca corrige nada sozinho, só relata. Responder em português.

## Fluxo
1. Anunciar início e listar as categorias que serão testadas.
2. Pedir os arquivos de importação necessários para o projeto (um de cada formato aceito, com e sem senha, duplicado, de bancos/fornecedores diferentes, escaneado). Gerar sozinho os inválidos (vazio, corrompido, extensão trocada, grande demais, PDF com script).
3. Para cada etapa oferecer: executar agora, **pular para depois** ou **concluir e gerar relatório**. Etapas puladas são solicitadas novamente no fim. Salvar o progresso em `/mnt/documents/rapaduramanbr/<projeto>/estado.json` (etapas concluídas, pendentes, achados) para retomar depois do ponto em que parou.
4. Categorias:
   - Testes automáticos existentes (vitest/playwright) e build.
   - Importação: cada arquivo, senha certa/errada, reimportação sem duplicar, conferência dos valores.
   - Chaves e amarração: duplicidade em chaves naturais, FKs órfãs, índices únicos.
   - Segurança: acesso sem login a cada tabela (leitura e gravação) e função do servidor, RPCs, escalada de privilégio, isolamento entre usuários, enumeração de e-mails, scanner/linter de segurança.
   - Interação entre usuários: contas temporárias `robo-*@teste` por perfil, aprovações, permissões por módulo, bloqueios.
   - Módulos e processos: navegação por perfil, alertas coerentes com dados, exclusões com impacto.
   - Exportação: todos os formatos abrem e respeitam permissões.
   - Erros capturados: logs de tela, rede, servidor.
5. Dados criados são marcados como teste e apagados ao final, com conferência.
6. Relatório: `/mnt/documents/rapaduramanbr/<projeto>/relatorio-testes-<data>.pdf|.xlsx|.json` com resumo, gravidade (crítica/alta/média/baixa), evidência, causa provável e recomendação. Revisar visualmente todas as páginas do PDF. Usar a identidade visual do projeto (padrão: Verde Oliva).
7. Terminar perguntando quais falhas o usuário quer corrigir.
