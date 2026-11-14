/** Foto de perfil, ou a inicial do nome sobre o degradê da marca quando não há foto. */
export function Avatar({ name, url, size = 36, className = '' }: {
  name: string;
  url: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (url) {
    return (
      <img src={url} alt={`Foto de ${name}`} style={style}
        className={`shrink-0 rounded-full object-cover shadow-inner ring-2 ring-white ${className}`} />
    );
  }
  return (
    <div style={style} aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 font-bold text-white shadow-inner ring-2 ring-white ${className}`}>
      {name.trim().slice(0, 1).toUpperCase()}
    </div>
  );
}
