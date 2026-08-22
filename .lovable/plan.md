# Aparência, Configurações e Ajuda — evolução

## 1. Paleta e Tema (aparência)

- Nova aba **Aparência** dentro de Configurações (antigo Menu Gerencial), opcional para o usuário.
- Seleção de **paleta**: Verde Oliva (padrão), Azul Corporativo, Grafite, Terracota.
- Seleção de **tema/estilo**: Neutro, Escritório, Construção, Arquitetura, Meio Ambiente, Carros, Aviação — cada tema define o visual da tela inicial (imagem/ilustração do hero), o ícone/logo e os acentos visuais.
- Pré-visualização das cores antes de salvar; botão "Restaurar padrão".
- A escolha é **gravada no banco** (`app_settings.palette` / `theme_style`, já existentes) e aplicada globalmente assim que o app carrega — permanece após atualizar a página e após novo login.
- Onboarding continua funcionando e passa a usar a mesma lista de paletas/temas, sem duplicação.

## 2. Configurações (renomeação e conteúdo)

- "Menu Gerencial" passa a se chamar **Configurações** (título, descrição e item do menu).
- Remover a menção a **versão de testes** (texto e bloco correspondente).
- Mover para dentro de Configurações, em uma seção **Segurança**:
  - Ativar/desativar **Biometria / Face ID**
  - Ativar/desativar **PIN de acesso** (incluindo alterar PIN e "Esqueci o PIN")
  - Bloqueio automático (tempo de inatividade) e "Bloquear agora"
- Novo botão **Excluir conta**, ao final, em área de risco:
  - exige confirmação por **senha da conta**;
  - se biometria estiver configurada, exige também a verificação biométrica;
  - se PIN estiver configurado, exige também o PIN;
  - mostra o resumo do que será apagado e exige digitar `EXCLUIR` antes de confirmar;
  - apaga os dados do usuário e a conta de autenticação, limpa PIN/biometria locais e encerra a sessão.

## 3. Novo módulo "Minhas Informações"

- Diálogo próprio com abas:
  - **Meus dados** — o painel de perfil atual (com "Atualiza Informações!" e comparação do que mudou).
  - **Permissões de Módulos** — visível **apenas para o Máster**.
- Esses dois blocos saem de dentro de Configurações para não ficarem duplicados.

## 4. Menu suspenso do usuário

Ordem final:

```text
Tela Cheia
Ajuda / Passo a passo
Configurações
Perfis e Usuários      (apenas Máster)
Minhas Informações
─────────
Sair da conta
```

Biometria, PIN, bloqueio automático e "Bloquear agora" saem do menu (agora vivem em Configurações).

## 5. Ajuda & Manual do Usuário — mobile

- No mobile, a lista de etapas hoje fica cortada no item 3. Passa a usar **acordeão**: todas as etapas listadas em coluna, com rolagem vertical completa, abrindo o conteúdo ao clicar (uma etapa aberta por vez), incluindo dica e botão de atalho.
- No desktop, mantém o layout atual (lista lateral + painel de conteúdo).
- O container do diálogo passa a ter altura e rolagem corretas no mobile, sem conteúdo escondido.

## 6. Segurança

- Nova varredura de segurança ao final, para confirmar que não restam problemas abertos após as mudanças (incluindo o fluxo de exclusão de conta).

## Detalhes técnicos

- `src/lib/appearance.ts`: fonte única de paletas (tokens HSL para `--primary`, `--accent`, `--background`, `--ring`, etc.) e temas; função `applyAppearance()` que grava as variáveis CSS no `:root`.
- `AppearanceProvider` montado no `App.tsx`, alimentado por `useAppSettings()`, com cache em `localStorage` para evitar "flash" da paleta padrão antes do fetch.
- `FinanceHero` / logo passam a escolher a arte conforme `theme_style`.
- Exclusão de conta: nova ação `delete_account` na Edge Function `manage-org-users` (service role) — remove linhas do usuário nas tabelas de dados, `profiles`, `user_roles`, `app_settings` e o usuário em auth; validação de senha via `signInWithPassword` no cliente antes de chamar, mais verificação de PIN (`verifyPin`) e biometria (`useBiometricLock`) quando ativos; registro em `audit_logs`.
- Novos componentes: `AppearancePanel.tsx`, `MyInfoDialog.tsx`, `SecuritySettingsPanel.tsx`, `DeleteAccountDialog.tsx`; `AdminPanel.tsx` reorganizado em abas (Dados, Backup, Aparência, Segurança, Conta).
- `HelpDialog.tsx`: no breakpoint mobile renderiza `Accordion` (shadcn) com `ScrollArea` de altura total; desktop inalterado.
