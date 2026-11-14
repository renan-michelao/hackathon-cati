export function GavelIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13 10l7.383 7.418c.823 .82 .823 2.164 0 2.984l-.8 .803c-.823 .822 -2.16 .822 -2.983 0l-7.383 -7.419" />
      <path d="M7 9l4 4" />
      <path d="M4 6l4 4" />
      <path d="M8 10l-4 -4" />
      <path d="M10 8l-4 -4" />
      <path d="M3 21h4" />
    </svg>
  );
}
