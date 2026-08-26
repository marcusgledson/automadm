# Reestruturação de Organizações, Perfis e Acesso

Entrega em fases. Fase 1 e 2 conforme sua escolha; as demais seguem na sequência.

## Fase 1 — Empresa/Organização e Perfis

**Cadastro de Empresa (novo)**

- Nova tabela de organizações: CNPJ (único, validado com dígito verificador), Razão/Nome, Tipo de instituição, Telefone, E-mail e endereço completo (CEP, logradouro, número, complemento, bairro, cidade, UF).
- O Máster cadastra a Empresa ao escolher Co-participativo ou Corporativo. Cada usuário passa a referenciar a organização.

**Modo Pessoal**

- Some do menu: "Perfis e Usuários", botões de incluir usuário e atribuir perfis.
- Continua visível: Configurações (habilitar/desabilitar módulos) e Logs de Auditoria.
- Novo bloco "Migrar modo de uso" → ao escolher Co-participativo/Corporativo, abre o cadastro de Empresa por CNPJ.

**CNPJ já existente**

- Ao digitar o CNPJ, o app consulta se já existe organização. Se existir, mostra os dados da empresa (somente leitura) e envia um **pedido de acesso** ao Máster daquela empresa em vez de criar uma nova.

**Novo usuário pelo cadastro inicial**

- Ao escolher Co-participativo/Corporativo e informar o CNPJ existente, os dados da empresa aparecem para confirmação; o cadastro é criado já associado com perfil **Leitor** e status "pendente de aprovação".
- Enquanto pendente, o usuário vê apenas uma tela informativa.

**Notificações do Máster**

- Sino com dropdown no cabeçalho listando pedidos pendentes (novos cadastros e pedidos de acesso), com link direto para aprovar.
- Na aprovação, o Máster define o perfil (Máster/Operador/Colaborador/Leitor) e os módulos.

**Tela de Grupos de Perfis**

- Disponível só em Co-participativo/Corporativo: lista de perfis com seus módulos padrão e associação direta dos usuários ao grupo na mesma tela, inclusive logo após criar um usuário.

## Fase 2 — Tela de Autenticação

- **Criar Conta**: campo "Confirmar e-mail" e "Confirmar senha", com validação em tempo real e mensagens em português.
- **Força de senha** em pt-BR, com a frase: "A senha digitada é fraca em segurança e fácil de adivinhar. Por favor, escolha uma senha mais forte com letras, números e caracteres especiais." Mínimo de 8 e máximo de 20 caracteres.
- Toda a tela e as mensagens de erro do backend traduzidas para pt-BR (mapa de tradução de erros de autenticação).
- **Esqueci a senha** abaixo de "Não tem uma conta? Cadastrar" (oculto quando o acesso é via Google): o usuário digita o e-mail, a aplicação verifica se existe cadastro e mostra as opções disponíveis — e-mail mascarado (aparecendo os 3 primeiros e 3 ultimos digitos antes do @) e telefone mascarado (aparecendo apenas os 4 primeiros e 3 ultimos dígitos) quando houver WhatsApp cadastrado. Nesta fase o envio do código sai por e-mail; a opção WhatsApp aparece desabilitada como "em breve...".
- A verificação de existência será feita por função no servidor, sem expor a base de usuários (resposta genérica com rate limit).

## Fase 3 — E-mail de alertas e confirmações

- Uso do e-mail nativo do Lovable Cloud (fila, reenvio automático, registro de envios) para confirmações, códigos de recuperação, aprovação de cadastro e alertas de metas.
- Tela em Configurações para o Máster cadastrar um **SMTP próprio** (host, porta, segurança, usuário, senha, remetente) com botão "Enviar e-mail de teste"; credenciais guardadas com segurança no servidor. Quando configurado, o SMTP próprio tem prioridade sobre o nativo.

## Fase 4 — Temas, foto e SMS

**Temas** (fontes proprietárias da Microsoft não podem ser embutidas; usaremos equivalentes livres do Google Fonts)


| Tema          | Fonte                             | Imagem      | Ícones                |
| ------------- | --------------------------------- | ----------- | --------------------- |
| Neutro        | padrão                            | padrão      | padrão                |
| Escritório    | Italianno (≈ Harlow Solid Italic) | Escritório  | relatórios, planilhas |
| Construção    | Tangerine (≈ Blackadder ITC)      | Obra        | blocos, ferramentas   |
| Arquitetura   | Bungee (≈ Showcard Gothic)        | Arquitetura | flipchart, canetas    |
| Meio Ambiente | Tinos (≈ Times New Roman)         | Ypê         | frutas, árvores       |
| Carros        | Bungee Shade (≈ Bauhaus 93)       | Mustang     | rodas esportivas      |
| Aviação       | Tangerine (≈ Blackadder ITC)      | Aviação     | aeronaves             |


Cada tema passa a definir fonte, imagem de destaque e conjunto de ícones dos cards.

**Foto de perfil**: ao selecionar o arquivo, abre um recortador com zoom, arraste e enquadramento fixo, gerando a imagem já redimensionada.

**Leitura de SMS bancário**: revisão do reconhecedor (valores em formato brasileiro, débito/crédito, estorno, PIX, cartão, mensagens quebradas em partes), remetentes por banco mais tolerantes, testes com mensagens reais dos principais bancos e melhorias na fila de revisão.

## Fase 5 — Importação de PDF

- Estado "processando" que desabilita os botões do diálogo e ignora cliques duplos, impedindo lotes concorrentes.
- Deduplicação reforçada: chave estável por lançamento mantida entre reprocessamentos por correção de colunas, para que nenhum lançamento seja gravado duas vezes.
- Teste de integração: "Adicionar mais arquivos" não inicia importação, e "Prosseguir" processa cada arquivo uma única vez.

## Fase 6 — Varredura de duplicidades

Relatório (sem alterar nada antes da sua decisão) listando:

- Campos repetidos entre tabelas de cadastro e perfis (por exemplo dados de telefone e nome em mais de um lugar).
- Módulos permitidos definidos em dois lugares diferentes (por usuário e por perfil) e qual deve prevalecer.
- Telas e componentes com função equivalente.
- Rotas e cards duplicados no painel inicial.
Cada item com recomendação de manter, unificar ou excluir, para você aprovar item a item.

## Detalhes técnicos

- Novas tabelas: `organizations` (CNPJ único, dados cadastrais) e `org_access_requests` (solicitante, organização, status, decisor). `profiles`/`user_roles` ganham `organization_id` e status de aprovação; `org_owner_id` continua como escopo das políticas atuais.
- Grants e políticas por organização em toda tabela nova, com funções `security definer` para checar CNPJ existente e listar pedidos sem vazar dados de outras organizações.
- Verificação de e-mail em recuperação de senha via Edge Function com resposta mascarada e limite de tentativas.
- Tokens de recuperação e códigos com expiração curta e uso único.
- Temas: tokens de fonte/ícone adicionados em `src/lib/appearance.ts` e aplicados por `AppearanceProvider`.
- Recorte de foto com `react-easy-crop` e saída em canvas.
- Deduplicação de PDF por hash de (conta, data, valor, descrição normalizada), aplicada antes de gravar e reaproveitada após correção de colunas.

## Observação verificada

Hoje a tela "Perfis e Usuários" é liberada apenas por perfil Máster (`isMaster`), sem considerar o modo de uso; por isso o Máster em modo Pessoal ainda enxerga a gestão de usuários. A Fase 1 corrige isso.