import { supabase } from './supabase';

/** Consultas usadas pela tela Mês. Cada uma lê uma view do banco (RLS: só o dono). */

export type ResumoMes = { competencia: string; renda: number; saidas: number; saldo: number };
export type Categoria = { categoria: string; total: number };
export type FaturaProxima = { total: number; vencimento: string } | null;
export type AReceber = { total: number; pessoas: number };

const num = (v: unknown) => Number(v ?? 0);

export async function buscarResumo(competencia: string): Promise<ResumoMes | null> {
  const { data, error } = await supabase.from('v_mes')
    .select('competencia, renda, saidas, sobra').eq('competencia', competencia).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { competencia: data.competencia, renda: num(data.renda), saidas: num(data.saidas), saldo: num(data.sobra) };
}

export async function buscarMeses(): Promise<ResumoMes[]> {
  const { data, error } = await supabase.from('v_mes')
    .select('competencia, renda, saidas, sobra').order('competencia', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(d => ({ competencia: d.competencia, renda: num(d.renda), saidas: num(d.saidas), saldo: num(d.sobra) }));
}

/** Próximas faturas a vencer: soma as que vencem no mesmo mês da mais próxima. */
export async function buscarFaturaProxima(): Promise<FaturaProxima> {
  const hoje = new Date().toLocaleDateString('sv-SE');   // AAAA-MM-DD no fuso local (toISOString usa UTC)
  const { data, error } = await supabase.from('faturas')
    .select('total, vencimento').gte('vencimento', hoje).order('vencimento');
  if (error) throw error;
  if (!data?.length) return null;
  const mes = data[0].vencimento.slice(0, 7);
  const doMes = data.filter(f => f.vencimento.startsWith(mes));
  return { total: doMes.reduce((t, f) => t + num(f.total), 0), vencimento: data[0].vencimento };
}

/** O que ainda falta receber das outras pessoas na competência informada. */
export async function buscarAReceber(competencia: string): Promise<AReceber> {
  const { data, error } = await supabase.from('v_acertos')
    .select('pessoa, falta').eq('competencia', competencia).gt('falta', 0.009);
  if (error) throw error;
  return { total: (data ?? []).reduce((t, a) => t + num(a.falta), 0), pessoas: data?.length ?? 0 };
}

export async function buscarCategorias(competencia: string): Promise<Categoria[]> {
  const { data, error } = await supabase.from('v_categorias_mes')
    .select('categoria, total').eq('competencia', competencia).order('total', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(c => ({ categoria: c.categoria, total: num(c.total) }));
}
