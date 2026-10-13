/** Ícones de linha usados no app (mesmos traços do design). */
const CAMINHOS = {
  mes: 'M3 11l9-7 9 7 M5 10v9h14v-9 M10 19v-5h4v5',
  transacoes: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  lancar: 'M12 5v14 M5 12h14',
  acertos: 'M5 5h5v5H5z M14 5h5v5h-5z M5 14h5v5H5z M14 14h5v5h-5z',
  mais: 'M5 7h14 M5 12h14 M5 17h14',
  olho: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
  olhoFechado: 'M3 3l18 18 M10.6 5.1A10.4 10.4 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1 M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 005.4-1.6 M9.9 9.9a3 3 0 004.2 4.2',
  calendario: 'M4 5h16v15H4z M8 3v4 M16 3v4 M4 10h16',
  seta: 'M9 6l6 6-6 6',
  baixo: 'M6 9l6 6 6-6',
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({ nome, tamanho = 20, cor = 'currentColor' }: { nome: NomeIcone; tamanho?: number; cor?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {CAMINHOS[nome].split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
    </svg>
  );
}
