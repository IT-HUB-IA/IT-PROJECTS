// O logo da IT.IA redesenhado em SVG (mesmas proporções do arquivo original): "IT" branco e o ponto vermelho.
export function Logo({ className = "", cor = "#fff", ponto = "#FF0000", titulo = "IT.IA" }: { className?: string; cor?: string; ponto?: string; titulo?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 206" role="img" aria-label={titulo}>
      <rect x="0" y="0" width="40" height="203" rx="2" fill={cor} />
      <rect x="57" y="0" width="155" height="35" rx="2" fill={cor} />
      <rect x="116" y="30" width="40" height="173" rx="2" fill={cor} />
      <circle cx="226" cy="178" r="28" fill={ponto} />
    </svg>
  );
}
