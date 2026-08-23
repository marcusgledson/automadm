# Robustez de providers e recarga do preview

Objetivo: eliminar telas em branco causadas por estados antigos de hot-reload em providers (como o `AppearanceProvider`), com aviso amigável em caso de falha e um teste automático que confirma que a tela de login abre.

## 1. Recarga automática do preview em mudanças de providers

- Plugin leve no Vite (`vite.config.ts`) que observa os arquivos considerados "críticos de provider": `src/App.tsx`, `src/components/AppearanceProvider.tsx`, `src/hooks/useAuth.tsx` e `src/lib/appearance.ts`.
- Quando um desses arquivos muda, em vez de aplicar hot-reload parcial, o plugin dispara uma recarga completa da página no preview.
- Resultado: nunca mais fica um provider "meio atualizado" na memória do navegador.

## 2. ErrorBoundary com mensagem amigável

- Novo componente `src/components/AppErrorBoundary.tsx` (classe React com `componentDidCatch`).
- Envolve toda a árvore do app em `src/main.tsx`.
- Em caso de falha de carregamento de um provider, mostra um cartão em pt-BR usando os tokens de cor atuais: título "Não foi possível carregar o aplicativo", explicação curta, detalhe técnico recolhível e botão **Recarregar agora**.
- Sem cores fixas — apenas classes semânticas já existentes (`bg-background`, `text-foreground`, `card-elevated`).

## 3. Validação em tempo de execução no App

- `src/components/AppearanceProvider.tsx` passa a expor um contexto (`AppearanceContext`) e um hook `useAppearanceReady()`.
- Um pequeno componente `RequireAppearance` (dentro de `App.tsx`) verifica esse contexto antes de renderizar as rotas protegidas; se o provider não estiver registrado, lança um erro claro ("AppearanceProvider não está registrado…") que é capturado pelo ErrorBoundary acima, em vez de gerar tela branca.
- Aplicado dentro do `ProtectedRoute`, sem alterar a lógica de autenticação, onboarding, PIN ou biometria.

## 4. Teste de smoke da rota /auth

- Novo arquivo `src/test/auth-route.smoke.test.tsx` (Vitest + Testing Library, já configurados).
- Renderiza o `App` com a rota inicial `/auth` usando `MemoryRouter`, com o cliente do backend mockado (sem chamadas de rede).
- Verifica: a tela de login aparece, o `AppearanceProvider` está registrado e nenhum erro é lançado no console.
- Executado com o comando de testes do projeto.

## Detalhes técnicos

- `vite.config.ts`: plugin com `handleHotUpdate` que retorna `[]` e envia `{ type: "full-reload" }` para os caminhos monitorados.
- `AppearanceProvider`: `createContext<boolean | undefined>(undefined)` + provider com valor `true`; comportamento atual (cache local + aplicação da paleta) inalterado.
- `AppErrorBoundary`: estado `{ error }`, reset via `window.location.reload()`.
- Teste: `vi.mock("@/integrations/supabase/client")` devolvendo sessão nula e `from()` encadeável.
