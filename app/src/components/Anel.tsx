/** Aro de progresso em degradê âmbar (0 a 1). Com alerta (passou de 100%), fica vermelho. */
export function Anel({ fracao, tamanho = 56, espessura = 8, alerta = false }: { fracao: number; tamanho?: number; espessura?: number; alerta?: boolean }) {
  const r = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao));
  const id = `anel-${tamanho}-${alerta ? 'alerta' : 'normal'}`;
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={alerta ? '#FF7A5C' : '#FFC765'} /><stop offset="1" stopColor={alerta ? '#D93A2B' : '#E8892E'} />
        </linearGradient>
      </defs>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={espessura} />
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={espessura}
        strokeDasharray={volta} strokeDashoffset={volta * (1 - f)} strokeLinecap="round"
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`} style={{ filter: `drop-shadow(0 0 5px ${alerta ? 'rgba(240,83,63,0.6)' : 'rgba(242,160,60,0.6)'})` }} />
    </svg>
  );
}
