import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  LogIn,
  LayoutDashboard,
  FileSpreadsheet,
  FolderOpen,
  Landmark,
  PencilLine,
  Database,
  CheckCircle2,
  LogOut,
  Lightbulb,
  Zap,
  Receipt,
  Download,
  FileText,
  BookOpen,
  ArrowRight,
} from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = {
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
  tip?: string;
  jumpTo?: { label: string; path: string };
};

const steps: Step[] = [
  {
    icon: LogIn,
    title: "1. Fazer login",
    body: (
      <>
        Acesse a tela inicial e informe seu <strong>e-mail</strong> e <strong>senha</strong>.
        Se ainda não tiver conta, use a aba <em>Cadastrar</em> para criar uma nova.
      </>
    ),
    tip: "Após 15 minutos sem atividade, o sistema encerra a sessão automaticamente por segurança.",
  },
  {
    icon: LayoutDashboard,
    title: "2. Escolher o módulo no Painel",
    body: (
      <>
        No painel principal você verá os módulos disponíveis:
        <ul className="mt-2 space-y-1 pl-4">
          <li className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> <strong>Análise de Extrato</strong> — importar OFX.</li>
          <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-accent" /> <strong>Faturas Neoenergia</strong> — importar contas de energia.</li>
          <li className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-emerald-600" /> <strong>Central de Contas</strong> — despesas consolidadas.</li>
        </ul>
      </>
    ),
    jumpTo: { label: "Ir para o Painel", path: "/" },
  },
  {
    icon: FolderOpen,
    title: "3. Importar o arquivo OFX",
    body: (
      <>
        No módulo <strong>Análise de Extrato</strong>, você pode:
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          <li>Arrastar um arquivo <code>.ofx</code> na área indicada, ou</li>
          <li>Clicar em <em>Selecionar Arquivo OFX</em>, ou</li>
          <li>Buscar direto de uma <strong>pasta pública do Google Drive</strong>.</li>
        </ul>
      </>
    ),
    tip: "Se o download do Drive travar, use o botão Cancelar e Tentar novamente.",
    jumpTo: { label: "Abrir Análise de Extrato", path: "/extrato" },
  },
  {
    icon: Landmark,
    title: "4. Confirmar Agência e Conta",
    body: (
      <>
        O sistema detecta automaticamente <strong>Banco, Agência e Conta</strong> do OFX.
        Quando o arquivo contém <strong>mais de uma conta</strong>, uma pré-visualização permite
        escolher qual bloco importar. Se faltarem dados, você pode informá-los manualmente.
      </>
    ),
    jumpTo: { label: "Ir para importação", path: "/extrato" },
  },
  {
    icon: PencilLine,
    title: "5. Revisar e editar lançamentos",
    body: (
      <>
        Antes de salvar, clique em <strong>Revisar / Editar</strong> para:
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          <li>Ajustar <strong>descrição</strong> e <strong>categoria</strong>;</li>
          <li>Marcar linhas para <strong>ignorar</strong> na importação;</li>
          <li>Conferir valores e datas.</li>
        </ul>
      </>
    ),
    jumpTo: { label: "Ir para revisão", path: "/extrato" },
  },
  {
    icon: Database,
    title: "6. Salvar na base",
    body: (
      <>
        Clique em <strong>Salvar na Base</strong>. Um resumo aparece com o banco, agência,
        conta e quantidade de lançamentos. Confirme para gravar — os dados vão para o
        extrato e também para a Central de Despesas.
      </>
    ),
    jumpTo: { label: "Ir para salvamento", path: "/extrato" },
  },
  {
    icon: CheckCircle2,
    title: "7. Conferir o resumo final",
    body: (
      <>
        Ao concluir, você verá quantos lançamentos foram salvos no <strong>extrato</strong> e
        quantos foram vinculados como <strong>despesas</strong>. A partir daí, é possível
        exportar em XLSX ou seguir para outros módulos.
      </>
    ),
    jumpTo: { label: "Ver Central de Contas", path: "/contas" },
  },
  {
    icon: LogOut,
    title: "8. Sair com segurança",
    body: (
      <>
        No menu de usuário (canto superior direito), use <strong>Sair da conta</strong> para
        encerrar a sessão. Em dispositivos móveis, é possível também restaurar a tela cheia
        pelo mesmo menu.
      </>
    ),
  },
];

export default function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const navigate = useNavigate();
  const jump = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-primary" />
            Ajuda — Passo a passo
          </DialogTitle>
          <DialogDescription>
            Do login até o salvamento do extrato na base. Siga na ordem sugerida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/30 px-6 py-3">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href="/manual-do-usuario.pdf" target="_blank" rel="noopener noreferrer">
              <FileText className="h-3.5 w-3.5" />
              Visualizar Manual (PDF)
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href="/manual-do-usuario.pdf" download="manual-do-usuario.pdf">
              <Download className="h-3.5 w-3.5" />
              Baixar PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href="/manual-do-usuario.docx" download="manual-do-usuario.docx">
              <Download className="h-3.5 w-3.5" />
              Baixar DOCX
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => jump("/faq")}
          >
            <BookOpen className="h-3.5 w-3.5" />
            FAQ &amp; Problemas
          </Button>
        </div>

        <ScrollArea className="max-h-[60vh] px-6 py-4">
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li
                key={i}
                className="relative rounded-lg border border-border/60 bg-card/60 p-4 transition-colors hover:bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                    <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {s.body}
                    </div>
                    {s.tip && (
                      <div className="mt-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-foreground/80">
                        <strong className="text-accent">Dica: </strong>
                        {s.tip}
                      </div>
                    )}
                    {s.jumpTo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
                        onClick={() => jump(s.jumpTo!.path)}
                      >
                        {s.jumpTo.label}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
