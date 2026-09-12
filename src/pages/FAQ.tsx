import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserMenu from "@/components/UserMenu";

const faqs = [
  {
    q: "Como consultar extratos que já foram salvos?",
    a: (
      <>
        Abra <strong>Análise de Extrato Bancário</strong> e selecione a aba <strong>Consultar base</strong>.
        Você pode filtrar por banco, conta, titular e período, além de exportar o resultado.
      </>
    ),
  },
  {
    q: "Falha ao baixar OFX do Google Drive",
    a: (
      <>
        Verifique se a pasta está compartilhada como <strong>“Qualquer pessoa com o link”</strong>.
        Erros 401/403 indicam pasta privada; 404, link inválido. Use o botão <em>Tentar novamente</em>
        no card de importação — se persistir, baixe o arquivo manualmente e use <em>Selecionar arquivo</em>.
      </>
    ),
  },
  {
    q: "OFX com múltiplas contas",
    a: (
      <>
        Quando o arquivo contém mais de uma conta, o pré-visualizador exibe todas as agências/contas
        detectadas. Selecione o bloco desejado (radio) e clique em <em>Importar conta selecionada</em>.
        Cada conta pode ser importada separadamente repetindo o processo.
      </>
    ),
  },
  {
    q: "Erro ao interpretar (parse) o OFX",
    a: (
      <>
        Alguns bancos exportam OFX 2.x (XML) e outros SGML. O app aceita ambos. Se falhar, confira
        se o arquivo não está truncado (baixe novamente) e se a extensão é <code>.ofx</code>.
        Arquivos <code>.qfx</code>/<code>.qif</code> não são suportados diretamente.
      </>
    ),
  },
  {
    q: "Agência/Conta não detectadas",
    a: (
      <>
        Um diálogo será aberto para preenchimento manual, com máscara <code>00000-0</code> para conta.
        A agência é apenas dígitos. Estes campos formam a chave única do extrato — não podem ficar em branco.
      </>
    ),
  },
  {
    q: "Fatura Neoenergia não é processada / dados genéricos",
    a: (
      <>
        Cada PDF é validado antes do processamento. Os arquivos liberados continuam normalmente; para os
        protegidos, informe a <strong>senha do PDF</strong> no pop-up (geralmente o CPF/CNPJ do titular).
        O status individual informa quais arquivos foram liberados, rejeitados ou ainda aguardam senha.
      </>
    ),
  },
  {
    q: "Erro 429 (limite de requisições da IA)",
    a: (
      <>
        O gateway aplica rate-limit por minuto. O app já faz retry automático com backoff.
        Se persistir, reduza o lote (importe menos faturas por vez) ou aguarde alguns minutos.
      </>
    ),
  },
  {
    q: "Fatura duplicada",
    a: (
      <>
        A chave única é <strong>Código de Instalação + Data de Vencimento</strong>. Reimportar
        atualiza o registro existente (não duplica). Para forçar nova leitura, apague a fatura
        no Menu Gerencial antes.
      </>
    ),
  },
  {
    q: "Como fazer backup dos dados",
    a: (
      <>
        Menu do usuário → <em>Menu Gerencial</em> → <em>Exportar backup completo</em>. O JSON contém
        extratos, faturas, despesas e links do Drive. A exportação para o Google Drive é criptografada
        no estilo WhatsApp e só pode ser aberta pelo mesmo login.
      </>
    ),
  },
  {
    q: "Por que meus links do Google Drive mudam entre as telas?",
    a: (
      <>
        Os links são separados pelo módulo e pelo tipo de arquivo. Pastas de PDF ficam no importador de contas,
        enquanto pastas de OFX aparecem no módulo de Extrato. Isso evita usar uma pasta na tela errada.
      </>
    ),
  },
  {
    q: "Como incluir um investimento sem arquivo?",
    a: (
      <>
        Abra <strong>Meus Investimentos</strong> e escolha <strong>Inclusão manual</strong>. Informe a instituição,
        o ativo, a data de aplicação e os valores disponíveis; depois confirme para salvar.
      </>
    ),
  },
  {
    q: "Sessão expirou sozinha",
    a: <>Por segurança, após 15 minutos sem atividade a sessão é encerrada automaticamente.</>,
  },
  {
    q: "App abriu em tela cheia no celular",
    a: (
      <>
        É intencional para melhor experiência em PWA. Saia pelo menu do usuário → <em>Restaurar tela</em>.
      </>
    ),
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">Voltar</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">Perguntas Frequentes</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")} title="Tela inicial">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Tela inicial</span>
          </Button>
          <UserMenu />
        </div>
      </header>
      <main className="safe-bottom mx-auto w-full max-w-3xl flex-1 p-4 sm:p-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">FAQ &amp; Solução de Problemas</h1>
          <p className="text-sm text-muted-foreground">
            Respostas rápidas para as dúvidas e erros mais comuns · Atualizado em setembro de 2026.
          </p>
        </div>
        <Accordion type="single" collapsible className="rounded-lg border border-border/60 bg-card/60">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="px-4">
              <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}
