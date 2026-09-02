# Importação com senha, revisão de boletos, consulta de extratos e investimento manual

## 1. Senha de PDF por arquivo (Google Drive)

Hoje a senha é validada apenas no primeiro PDF e, se falhar, toda a importação para.

Novo comportamento:

- A senha digitada é testada em **todos** os arquivos selecionados antes de processar.
- Os arquivos que aceitam a senha seguem o processamento normalmente.
- Os que recusam ficam com status "Senha incorreta" e abrem um **pop-up** pedindo a senha correta apenas para esses arquivos (com o nome do arquivo em destaque e a dica de senha quando o PDF traz uma).
- O campo de senha é exibido **em texto visível** (sem máscara), já que se trata de senha de documento e não de conta.
- O ciclo se repete até que todos sejam liberados ou o usuário desista dos restantes.
- Cada arquivo mostra o status: pendente / senha exigida / processando / importado / erro.

Ao final, os dados importados são gravados em `consumption_bills` e ficam visíveis na **Central de Contas e Despesas**.

## 2. Central de Contas e Despesas — importação com senha e status

- O upload universal passa a detectar PDF protegido e abrir o mesmo pop-up de senha (campo visível, por arquivo).
- Painel de status da importação por arquivo: senha exigida, lido, revisado, gravado, duplicado, erro — comprovando a captação das informações.
- Não pode haver duplicidade de informações, portanto, chacar as linhas já existentes pela chave da informação antes de gravá-las.

## 3. Leitura aprimorada de boletos e tela de revisão

- Prompt de extração ampliado para boletos de tributos (IPTU/IPVA/taxas): inscrição/renavam, exercício, cota/parcela, número do documento, contribuinte, valor principal, multa, juros, desconto, taxas, linha digitável, vencimentos alternativos e composição por item.
- **Tela de revisão sempre**: após a leitura, abre um painel mostrando todos os campos capturados, com o mapeamento sugerido para as colunas da Central de Contas. O usuário confere, corrige e escolhe quais campos vão para cada coluna antes de gravar.
- Campos não mapeados ficam guardados no detalhe da fatura.

## 4. Extrato Financeiro — consulta do que foi salvo

- Ao "Salvar na Base", garantir a gravação de banco, agência, conta, titular e documento junto aos lançamentos.
- Nova aba "Consultar base" no Extrato, com filtros por **Banco**, **Conta (agência/conta)** e **Titular**, período e tipo de lançamento, listando o extrato já gravado com totais.

## 5. Modo Leitura x Gravação (Extrato, Central de Contas e Investimentos)

- Seletor no topo de cada módulo de importação:
  - **Apenas leitura**: processa e exibe, sem gravar na base.
  - **Gravação**: grava na base e libera o painel de destino do arquivo gerado:
    - salvar local (download),
    - enviar ao **Google Drive** (integração já existente),
    - enviar ao **OneDrive** (novo).
- A preferência fica salva por usuário.

## 6. Meus Investimentos — inclusão manual

- Botão "Novo investimento" abrindo formulário com os campos da tabela (instituição, tipo, ativo, valores, datas de aplicação/vencimento/carência, liquidez, indexador, taxa, IR/IOF, quantidade, preço, observações), com validação e as mesmas explicações em linguagem simples.
- Gravação via upsert existente (`instituicao + ativo + data_aplicacao`), evitando duplicidade, com origem "manual".

## Detalhes técnicos

- `GoogleDriveImport.tsx`: fila de validação por arquivo; nova função `validate-pdf-password` chamada em lote; estado `passwordPrompt` (arquivo, dica) e diálogo com `type="text"`.
- `validate-pdf-password` / `download-drive-file`: retornar código de erro distinto para senha inválida e a dica de senha (`/Encrypt` + metadados), sem vazar conteúdo.
- `UniversalBillUpload.tsx` + novo `BillReviewDialog.tsx`: exibe campos extraídos e mapeamento para `consumption_bills`.
- `parse-bill/index.ts`: prompt e schema ampliados para tributos; campos extras em `raw_data`.
- `Index.tsx` + `useBankStatements`: aba de consulta com filtros no servidor (banco/conta/titular).
- Novo `src/lib/oneDriveBackup.ts` (MSAL implicit token + Graph upload) espelhando `googleDriveBackup.ts`; será necessário informar o Client ID do app Microsoft (`VITE_MS_CLIENT_ID`).
- Novo `ManualInvestmentDialog.tsx` em `Investimentos.tsx`.
- Nova migração: coluna de preferência `import_mode` em `app_settings` (com GRANTs).