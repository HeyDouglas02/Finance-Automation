/** 1617.76 → "1.617,76" */
export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 1617.76 → "R$ 1.617,76" e -232.76 → "−R$ 232,76" */
export function reaisComSinal(valor: number): string {
  return (valor < 0 ? '−' : '') + 'R$ ' + reais(Math.abs(valor));
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-10-01" → "Outubro 2026" */
export function nomeMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = MESES[mes - 1];
  return nome[0].toUpperCase() + nome.slice(1) + ' ' + ano;
}

/** Primeiro dia do mês atual, no formato do banco: "2026-10-01" */
export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Soma meses a "2026-10-01" → "2026-11-01" */
export function somaMes(competencia: string, n: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const d = new Date(ano, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** "2026-11-08" → "8 de nov." */
export function diaMesCurto(data: string): string {
  const curtos = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const [, mes, dia] = data.split('-').map(Number);
  return `${dia} de ${curtos[mes - 1]}`;
}
