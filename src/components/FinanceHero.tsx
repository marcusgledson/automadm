import ThemedHero from "@/components/ThemedHero";

interface Props {
  className?: string;
  priority?: boolean;
  editable?: boolean;
}

/**
 * Arte da tela inicial. Mantida como componente para compatibilidade:
 * a renderização segue o tema escolhido pelo usuário nas Configurações.
 */
export default function FinanceHero(props: Props) {
  return <ThemedHero {...props} />;
}
