import { supabase } from './supabase';

/** Consultas usadas pela tela Mês. Cada uma lê uma view do banco (RLS: só o dono). */

export type ResumoMes = { competencia: string; renda: number; saidas: number; saldo: number };
export type Categoria = { categoria: string; total: number };
export type FaturaCartao = { cartao: string; total: number; previsto: number; vencimento: string; fechada: boolean };
export type Fatura = {
  total: number; real: number; previsto: number; vencimento: string;
  situacao: 'fechada' | 'aberta' | 'prevista'; porCartao: FaturaCartao[];
} | null;
export type AReceber = { total: number; pessoas: number };

const num = (v: unknown) => Number(v ?? 0);

export async function buscarResumo(competencia: string): Promise<ResumoMes | null> {
  const { data, error } = await supabase.from('v_mes')
    .select('competencia, renda, saidas, sobra').eq('competencia', competencia).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { competencia: data.competencia, renda: num(data.renda), saidas: num(data.saidas), saldo: num(data.sobra) };
}

/** Primeiro mês com renda lançada. Antes dele a importação está incompleta (só compras, sem renda). */
export async function buscarPrimeiroMes(): Promise<string | null> {
  const { data, error } = await supabase.from('v_mes')
    .select('competencia').gt('renda', 0).order('competencia').limit(1).maybeSingle();
  if (error) throw error;
  return data?.competencia ?? null;
}

export async function buscarMeses(): Promise<ResumoMes[]> {
  const { data, error } = await supabase.from('v_mes')
    .select('competencia, renda, saidas, sobra').order('competencia', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(d => ({ competencia: d.competencia, renda: num(d.renda), saidas: num(d.saidas), saldo: num(d.sobra) }));
}

/** Faturas dos cartões no mês do orçamento: fechada = total do banco; aberta = compras que já chegaram + parcelas previstas. */
export async function buscarFatura(competencia: string): Promise<Fatura> {
  const { data, error } = await supabase.from('v_faturas_mes')
    .select('cartao, real, previsto, total, vencimento, fechada').eq('competencia', competencia).order('vencimento');
  if (error) throw error;
  if (!data?.length) return null;
  const porCartao = data.map(f => ({ cartao: f.cartao, total: num(f.total), previsto: num(f.previsto), vencimento: f.vencimento, fechada: f.fechada }));
  const situacao = porCartao.every(f => f.fechada) ? 'fechada'
    : data.some(f => num(f.real) !== 0) ? 'aberta' : 'prevista';   // nada real ainda = mês futuro
  return {
    total: porCartao.reduce((t, f) => t + f.total, 0),
    real: data.reduce((t, f) => t + num(f.real), 0),
    previsto: porCartao.reduce((t, f) => t + f.previsto, 0),
    vencimento: porCartao[0].vencimento, situacao, porCartao,
  };
}

/** O que ainda falta receber das outras pessoas na competência informada. */
export async function buscarAReceber(competencia: string): Promise<AReceber> {
  const { data, error } = await supabase.from('v_acertos')
    .select('pessoa, falta').eq('competencia', competencia).gt('falta', 0.009);
  if (error) throw error;
  return { total: (data ?? []).reduce((t, a) => t + num(a.falta), 0), pessoas: data?.length ?? 0 };
}

export type Parcela = {
  descricao: string; cartao: string; num: number; total: number; status: string;
  valor: number; minhaParte: number; valorRestante: number; ultima: string; pessoas: { nome: string; valor: number }[];
};

/** Parcelas que caem no mês (reais e previstas), da maior pra menor. */
export async function buscarParcelamentos(competencia: string): Promise<Parcela[]> {
  const { data, error } = await supabase.from('v_parcelamentos')
    .select('descricao, cartao, parcela_num, parcela_total, status, valor, minha_parte, valor_restante, ultima_competencia, dividido_com')
    .eq('competencia', competencia).order('valor', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(p => ({
    descricao: p.descricao, cartao: p.cartao, num: p.parcela_num, total: p.parcela_total, status: p.status,
    valor: num(p.valor), minhaParte: num(p.minha_parte), valorRestante: num(p.valor_restante), ultima: p.ultima_competencia,
    // dividido_com vem como "Pai 42.99, Mãe 30.26"
    pessoas: p.dividido_com ? p.dividido_com.split(', ').map((q: string) => {
      const i = q.lastIndexOf(' ');
      return { nome: q.slice(0, i), valor: num(q.slice(i + 1)) };
    }) : [],
  }));
}

export type LinhaSaida = { nome: string; valor: number };

/** Grupo de um lançamento no resumo do saldo e na lista de Transações (os dois precisam bater). */
export function grupoDe(tipo: string, origem: string | null): string {
  if (tipo === 'Renda') return 'Renda';
  if (tipo === 'Gasolina') return 'Gasolina';   // vem de dois cartões (Pai, Carrefour): uma linha só
  if (tipo === 'Débito') return 'Débitos';
  return origem ?? 'Outros';
}

/** De onde vêm as saídas do mês (sua parte): um total por cartão, mais contas fixas, débitos e gasolina. */
export async function buscarSaidas(competencia: string): Promise<LinhaSaida[]> {
  const { data, error } = await supabase.from('v_lancamentos')
    .select('tipo, origem, minha_parte').eq('competencia', competencia).neq('tipo', 'Renda');
  if (error) throw error;
  const grupos = new Map<string, number>();
  (data ?? []).forEach(l => {
    const nome = grupoDe(l.tipo, l.origem);
    grupos.set(nome, (grupos.get(nome) ?? 0) + num(l.minha_parte));
  });
  return [...grupos].map(([nome, valor]) => ({ nome, valor }))
    .filter(g => Math.abs(g.valor) >= 0.005).sort((a, b) => b.valor - a.valor);
}

export async function buscarCategorias(competencia: string): Promise<Categoria[]> {
  const { data, error } = await supabase.from('v_categorias_mes')
    .select('categoria, total').eq('competencia', competencia).order('total', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(c => ({ categoria: c.categoria, total: num(c.total) }));
}

export type Lancamento = {
  ref: string; grupo: string; tipo: string; descricao: string; data: string | null;
  categoria: string | null; status: string; valor: number; minhaParte: number; pessoas: string[]; pendente: boolean;
};

/** Tudo do mês (compras, parcelas, fixas, débitos, gasolina, renda), mais recente primeiro. */
export async function buscarTransacoes(competencia: string): Promise<Lancamento[]> {
  const [lancamentos, pendentes] = await Promise.all([
    supabase.from('v_lancamentos')
      .select('ref, tipo, descricao, valor, minha_parte, dividido_com, categoria, status, origem, data')
      .eq('competencia', competencia).order('data', { ascending: false, nullsFirst: false }),
    // compras que chegaram do banco e ainda não foram classificadas
    supabase.from('transacoes').select('id').eq('competencia', competencia).eq('tipo', 'gasto').eq('revisado', false),
  ]);
  if (lancamentos.error) throw lancamentos.error;
  if (pendentes.error) throw pendentes.error;
  const naoRevisadas = new Set((pendentes.data ?? []).map(t => 'tx:' + t.id));
  return (lancamentos.data ?? []).map(l => ({
    ref: l.ref, grupo: grupoDe(l.tipo, l.origem), tipo: l.tipo, descricao: l.descricao, data: l.data,
    categoria: l.categoria, status: l.status, valor: num(l.valor), minhaParte: num(l.minha_parte),
    // dividido_com vem como "Pai 42.99, Mãe 30.26": só os nomes
    pessoas: l.dividido_com ? l.dividido_com.split(', ').map((q: string) => q.slice(0, q.lastIndexOf(' '))) : [],
    pendente: naoRevisadas.has(l.ref),
  }));
}
