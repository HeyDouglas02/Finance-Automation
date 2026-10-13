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

/** "2026-10-08" → "Venceu" se já passou (fuso local), senão "Vence" */
export function venceOuVenceu(data: string): string {
  return data < new Date().toLocaleDateString('sv-SE') ? 'Venceu' : 'Vence';
}

/** "2026-11-08" → "8 de nov." */
export function diaMesCurto(data: string): string {
  const curtos = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const [, mes, dia] = data.split('-').map(Number);
  return `${dia} de ${curtos[mes - 1]}`;
}

/** "5541999998888" → "(41) 99999-8888" */
export function telefoneLegivel(telefone: string): string {
  const n = telefone.slice(2);   // sem o 55
  return `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}`;
}

/** Gasolina (regra 7): mês do orçamento pelo fechamento do cartão; vence no mês seguinte a ele. */
export function competenciaGasolina(data: string, cartao: { diaFechamento: number; diaVencimento: number; mesesAteVencer: number }) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const competencia = somaMes(`${ano}-${String(mes).padStart(2, '0')}-01`, (dia <= cartao.diaFechamento ? 0 : 1) + cartao.mesesAteVencer - 1);
  const vencimento = somaMes(competencia, 1).slice(0, 8) + String(cartao.diaVencimento).padStart(2, '0');
  return { competencia, vencimento };
}
