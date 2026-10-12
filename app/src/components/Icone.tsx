/** Ícones de linha usados no app (mesmos traços do design). */
const CAMINHOS = {
  mes: 'M3 11l9-7 9 7 M5 10v9h14v-9 M10 19v-5h4v5',
  revisar: 'M4 7h16v13H4z M9 13l2 2 4-4',
  lancar: 'M12 5v14 M5 12h14',
  acertos: 'M5 5h5v5H5z M14 5h5v5h-5z M5 14h5v5H5z M14 14h5v5h-5z',
  mais: 'M5 7h14 M5 12h14 M5 17h14',
  sino: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
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
