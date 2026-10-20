// Regras de negócio da sincronização. Funções puras: sem banco, sem rede.
// Ver docs/regras-de-negocio.md

export const TZ = 'America/Sao_Paulo';

export type Cartao = { id: number; nome: string; dia_fechamento: number };
export type Regra = { texto: string; categoria_id: number; divisao_padrao: unknown; valor: number | null };

/** Remove acentos, deixa em maiúsculas e junta espaços. */
export function norm(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Data ISO da Pluggy → 'aaaa-mm-dd' no fuso de São Paulo (data "pura" é mantida como veio). */
export function dataLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/T00:00:00(\.000)?Z$/.test(iso)) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

/** Soma meses a 'aaaa-mm-01'. */
export function somaMes(mes: string, n: number): string {
  let y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) + n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/**
 * Mês do orçamento de uma compra no cartão:
 *  - com fatura conhecida: mês anterior ao vencimento;
 *  - sem fatura (ainda aberta): até o dia de fechamento, o próprio mês; depois, o seguinte.
 */
export function competencia(data: string, vencimentoFatura: string | null, diaFechamento: number): string {
  if (vencimentoFatura) return somaMes(vencimentoFatura.slice(0, 7) + '-01', -1);
  const mes = data.slice(0, 7) + '-01';
  return Number(data.slice(8, 10)) <= diaFechamento ? mes : somaMes(mes, 1);
}

/** Pagamento da fatura: não é gasto (senão a compra contaria duas vezes). */
export function ehPagamentoFatura(descricao: string, categoriaPluggy?: string | null): boolean {
  return /PAG BOLETO|PAGTO DEBITO AUTOMATICO|PAGAMENTO ON LINE|PAGTO\. POR DEB|PAGAMENTO FATURA/.test(norm(descricao)) ||
    categoriaPluggy === 'Credit card payment' || categoriaPluggy === 'Transfer - Internal';
}

/** Juros, IOF, multa e encargos. */
export function ehTaxa(descricao: string, categoriaPluggy?: string | null): boolean {
  return /\bIOF\b|JUROS|ENCARGOS|ANUIDADE|MULTA|ROTATIVO/.test(norm(descricao)) ||
    ['Interests charged', 'Bank fees', 'Tax on financial operations'].includes(categoriaPluggy ?? '');
}

/**
 * Primeira regra (por prioridade) cujo texto aparece na descrição.
 * Regra com valor só vale para compras desse valor (ex.: a assinatura da apple.com).
 */
export function achaRegra(descricao: string, valor: number, regras: Regra[]): Regra | null {
  const d = norm(descricao);
  return regras.find(r => r.texto && d.includes(norm(r.texto)) &&
    (r.valor == null || Math.abs(Number(r.valor) - valor) < 0.01)) ?? null;
}

/** Chave que agrupa as parcelas da mesma compra (igual à usada na view v_itens). */
export function grupoParcela(cartaoId: number, descricao: string, total: number | null, compraOriginal: string | null): string | null {
  if (!total) return null;
  return `${cartaoId}|${norm(descricao)}|${total}|${compraOriginal ? compraOriginal.slice(0, 7) : ''}`;
}

/** Valor em reais: compras internacionais vêm na moeda original em "amount". */
export function valorEmReais(t: { amount: number; amountInAccountCurrency?: number | null; currencyCode?: string | null }): number {
  const v = t.amountInAccountCurrency != null && t.currencyCode && t.currencyCode !== 'BRL'
    ? t.amountInAccountCurrency : t.amount;
  return Math.round(v * 100) / 100;
}

/** Duas transações são "a mesma" se tiverem mesmo cartão, valor e data até 7 dias de distância. */
export function mesmaCompra(a: { cartao_id: number; valor: number; data: string },
                            b: { cartao_id: number; valor: number; data: string }): boolean {
  const dias = Math.abs(new Date(a.data).getTime() - new Date(b.data).getTime()) / 864e5;
  return a.cartao_id === b.cartao_id && Math.abs(a.valor - b.valor) < 0.01 && dias <= 7;
}
