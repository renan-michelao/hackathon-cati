export function GavelIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 25 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Base de apoio (sound block) */}
      <rect x="1.5" y="19.8" width="11.5" height="3.4" rx="1.7" />

      {/* Martelo / Gavel inclinado */}
      <g transform="rotate(-45 10.8 7.2)">
        {/* Cabo com ponta arredondada */}
        <rect x="9.9" y="9.7" width="1.8" height="13.5" rx="0.9" />

        {/* Cilindro central da cabeça */}
        <rect x="6.8" y="4.7" width="8" height="5" rx="0.5" />

        {/* Anel/Placa esquerda */}
        <rect x="4.8" y="3.8" width="2" height="6.8" rx="0.8" />

        {/* Anel/Placa direita */}
        <rect x="14.8" y="3.8" width="2" height="6.8" rx="0.8" />
      </g>
    </svg>
  );
}
