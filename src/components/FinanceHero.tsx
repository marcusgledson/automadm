import financeHero from "@/assets/finance-hero.jpg";

interface Props {
  className?: string;
  priority?: boolean;
}

/**
 * Decorative finance illustration with subtle interactive hover/tilt.
 * Used on Auth and Dashboard to harmonize the financial theme.
 */
export default function FinanceHero({ className = "", priority = false }: Props) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
      />
      <img
        src={financeHero}
        alt="Ilustração de gestão financeira: gráficos, moedas, calculadora e crescimento"
        width={1280}
        height={960}
        loading={priority ? "eager" : "lazy"}
        className="relative h-full w-full object-contain p-2 transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.03] group-hover:-rotate-[0.4deg] motion-safe:animate-fade-up"
      />
    </div>
  );
}
