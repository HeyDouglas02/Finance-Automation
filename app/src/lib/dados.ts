import { supabase } from './supabase';

/** Consultas usadas pela tela Mês. Cada uma lê uma view do banco (RLS: só o dono). */

export type ResumoMes = { competencia: string; renda: number; saidas: number; saldo: number };
export type Categoria = { categoria: string; total: number };
export type FaturaCartao = {
  cartao: string; total: number; previsto: number; vencimento: string; fechada: boolean;
  somaCompras: number; encargos: number;   // conferência (regra 10), só em fatura fechada
};
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
    .select('cartao, real, previsto, total, vencimento, fechada, soma_compras, encargos').eq('competencia', competencia).order('vencimento');
  if (error) throw error;
  if (!data?.length) return null;
  const porCartao = data.map(f => ({
    cartao: f.cartao, total: num(f.total), previsto: num(f.previsto), vencimento: f.vencimento, fechada: f.fechada,
    somaCompras: num(f.soma_compras), encargos: num(f.encargos),
  }));
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
  divergencia: string | null;   // ex.: "Esperado 65,00" ou "Parcela anterior 98,35" (regras 3 e 5)
};

/** Tudo do mês (compras, parcelas, fixas, débitos, gasolina, renda), mais recente primeiro. */
export async function buscarTransacoes(competencia: string): Promise<Lancamento[]> {
  const [lancamentos, pendentes] = await Promise.all([
    supabase.from('v_lancamentos')
      .select('ref, tipo, descricao, valor, minha_parte, dividido_com, categoria, status, origem, data, divergencia')
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
    divergencia: l.divergencia,
  }));
}

export type Opcao = { id: number; nome: string };
export type Rateio = { pessoa_id: number; valor: number | null; percentual: number | null };
export type Compra = {
  id: string; descricao: string; valor: number; data: string; cartao: string;
  parcelaNum: number | null; parcelaTotal: number | null; categoriaId: number | null; rateios: Rateio[];
};

/** Categorias (sem "A revisar", que não é escolha válida) e pessoas, pra montar a classificação. */
export async function buscarOpcoes(): Promise<{ categorias: Opcao[]; pessoas: Opcao[] }> {
  const [c, p] = await Promise.all([
    supabase.from('categorias').select('id, nome').neq('nome', 'A revisar').order('nome'),
    supabase.from('pessoas').select('id, nome').order('id'),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  return { categorias: c.data ?? [], pessoas: p.data ?? [] };
}

export async function buscarCompra(id: string): Promise<Compra> {
  const { data, error } = await supabase.from('transacoes')
    .select('id, descricao, valor, data, parcela_num, parcela_total, categoria_id, cartoes(nome), rateios(pessoa_id, valor, percentual)')
    .eq('id', id).single();
  if (error) throw error;
  const cartao = data.cartoes as unknown as { nome: string } | null;   // relação 1:1, o tipo gerado não sabe
  return {
    id: data.id, descricao: data.descricao, valor: num(data.valor), data: data.data, cartao: cartao?.nome ?? '',
    parcelaNum: data.parcela_num, parcelaTotal: data.parcela_total, categoriaId: data.categoria_id,
    rateios: (data.rateios ?? []).map(r => ({ pessoa_id: r.pessoa_id, valor: r.valor === null ? null : num(r.valor), percentual: r.percentual === null ? null : num(r.percentual) })),
  };
}

/** Grava categoria + divisão (função classificar no banco, regra 11). Devolve quantas compras mudaram (parcelas seguintes incluídas). */
export async function classificar(id: string, categoriaId: number, rateios: Rateio[]): Promise<number> {
  const { data, error } = await supabase.rpc('classificar', { p_transacao: id, p_categoria: categoriaId, p_rateios: rateios });
  if (error) throw error;
  return data as number;
}

export type Acerto = {
  pessoaId: number; pessoa: string; telefone: string | null;
  devido: number; falta: number; itens: number; pago: boolean; ultimoPagamento: string | null;
};
export type ItemAcerto = { descricao: string; valor: number; previsto: boolean };

/** Quanto cada pessoa deve no mês e se já pagou (regra 9). */
export async function buscarAcertos(competencia: string): Promise<Acerto[]> {
  const [a, p] = await Promise.all([
    supabase.from('v_acertos').select('pessoa, devido, falta, itens, situacao, ultimo_pagamento')
      .eq('competencia', competencia).gt('devido', 0.009),
    supabase.from('pessoas').select('id, nome, telefone'),
  ]);
  if (a.error) throw a.error;
  if (p.error) throw p.error;
  return (a.data ?? []).map(x => {
    const pessoa = (p.data ?? []).find(q => q.nome === x.pessoa);
    return {
      pessoaId: pessoa?.id ?? 0, pessoa: x.pessoa, telefone: pessoa?.telefone ?? null,
      devido: num(x.devido), falta: num(x.falta), itens: x.itens, pago: x.situacao === 'Pago', ultimoPagamento: x.ultimo_pagamento,
    };
  }).sort((x, y) => Number(x.pago) - Number(y.pago) || x.pessoa.localeCompare(y.pessoa, 'pt-BR'));   // pendentes primeiro
}

export async function buscarItensAcerto(competencia: string, pessoa: string): Promise<ItemAcerto[]> {
  const { data, error } = await supabase.from('v_partes')
    .select('descricao, valor, status').eq('competencia', competencia).eq('pessoa', pessoa).order('valor', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(i => ({ descricao: i.descricao, valor: num(i.valor), previsto: i.status === 'Previsto' }));
}

/** Recebi: pagamento do valor exato do mês (regra 9). */
export async function registrarPagamento(competencia: string, pessoaId: number, valor: number): Promise<void> {
  const { error } = await supabase.from('pagamentos').insert({ competencia, pessoa_id: pessoaId, valor, data: new Date().toLocaleDateString('sv-SE') });
  if (error) throw error;
}

/** Desfaz o Recebi (apaga os pagamentos da pessoa naquele mês). */
export async function desfazerPagamento(competencia: string, pessoaId: number): Promise<void> {
  const { error } = await supabase.from('pagamentos').delete().eq('competencia', competencia).eq('pessoa_id', pessoaId);
  if (error) throw error;
}

export type Pessoa = { id: number; nome: string; telefone: string | null };

export async function buscarPessoas(): Promise<Pessoa[]> {
  const { data, error } = await supabase.from('pessoas').select('id, nome, telefone').order('id');
  if (error) throw error;
  return data ?? [];
}

/** Telefone só com dígitos, DDI 55 na frente se faltar ("(41) 99999-8888" → "5541999998888"). Vazio = null. */
export function normalizarTelefone(digitado: string): string | null {
  const digitos = digitado.replace(/\D/g, '');
  return !digitos ? null : digitos.length <= 11 ? '55' + digitos : digitos;
}

export async function salvarTelefone(id: number, digitado: string): Promise<string | null> {
  const telefone = normalizarTelefone(digitado);
  if (telefone && !/^\d{12,13}$/.test(telefone)) throw new Error('Número inválido: use DDD + número');
  const { error } = await supabase.from('pessoas').update({ telefone }).eq('id', id);
  if (error) throw error;
  return telefone;
}

export type CartaoManual = { id: number; nome: string; diaFechamento: number; diaVencimento: number; mesesAteVencer: number };
export type Lancado = { ref: string; tipo: 'renda' | 'debito' | 'gasolina'; id: number; descricao: string; valor: number; minhaParte: number };

/** Fontes de renda já usadas, da mais recente pra mais antiga (viram botões no Lançar). */
export async function buscarFontesRenda(): Promise<string[]> {
  const { data, error } = await supabase.from('renda').select('fonte, competencia').order('competencia', { ascending: false });
  if (error) throw error;
  return [...new Set((data ?? []).map(r => r.fonte))];
}

/** Cartões que não vêm do banco (gasolina é anotada à mão). */
export async function buscarCartoesManuais(): Promise<CartaoManual[]> {
  const { data, error } = await supabase.from('cartoes')
    .select('id, nome, dia_fechamento, dia_vencimento, meses_ate_vencer').eq('conectado', false).order('id');
  if (error) throw error;
  return (data ?? []).map(c => ({ id: c.id, nome: c.nome, diaFechamento: c.dia_fechamento, diaVencimento: c.dia_vencimento, mesesAteVencer: c.meses_ate_vencer }));
}

/** Renda, débitos e gasolina lançados à mão que caem no mês (débito parcelado aparece pela parcela do mês). */
export async function buscarLancados(competencia: string): Promise<Lancado[]> {
  const { data, error } = await supabase.from('v_lancamentos')
    .select('ref, descricao, valor, minha_parte').eq('competencia', competencia)
    .in('tipo', ['Renda', 'Débito', 'Gasolina']);
  if (error) throw error;
  return (data ?? []).map(l => {
    const [prefixo, id] = l.ref.split(':');   // "renda:12", "deb:7:0", "gas:3"
    const tipo = prefixo === 'renda' ? 'renda' : prefixo === 'deb' ? 'debito' : 'gasolina';
    return { ref: l.ref, tipo, id: Number(id), descricao: l.descricao, valor: num(l.valor), minhaParte: num(l.minha_parte) } as Lancado;
  });
}

export async function lancarRenda(competencia: string, fonte: string, valor: number): Promise<void> {
  const { error } = await supabase.from('renda').insert({ competencia, fonte: fonte.trim(), valor });
  if (error) throw error;
}

/** Débito + divisão (função lancar_debito no banco, regra 6). valor = de cada parcela. */
export async function lancarDebito(competencia: string, descricao: string, valor: number, parcelas: number, categoriaId: number, rateios: Rateio[]): Promise<void> {
  const { error } = await supabase.rpc('lancar_debito', {
    p_competencia: competencia, p_descricao: descricao, p_valor: valor, p_parcelas: parcelas, p_categoria: categoriaId, p_rateios: rateios,
  });
  if (error) throw error;
}

export async function lancarGasolina(data: string, valor: number, cartaoId: number): Promise<void> {
  const { error } = await supabase.from('abastecimentos').insert({ data, valor, cartao_id: cartaoId });
  if (error) throw error;
}

/** Exclui o lançamento inteiro (débito parcelado: todas as parcelas; a divisão vai junto). */
export async function excluirLancado(tipo: Lancado['tipo'], id: number): Promise<void> {
  const tabela = tipo === 'renda' ? 'renda' : tipo === 'debito' ? 'debitos' : 'abastecimentos';
  const { error } = await supabase.from(tabela).delete().eq('id', id);
  if (error) throw error;
}

export type ContaFixa = {
  id: number; nome: string; valor: number; forma: 'debito' | 'credito';
  inicio: string; fim: string | null; textoFatura: string | null;
};

export async function buscarContasFixas(): Promise<ContaFixa[]> {
  const { data, error } = await supabase.from('contas_fixas')
    .select('id, nome, valor, forma, inicio, fim, texto_fatura').order('nome').order('inicio');
  if (error) throw error;
  return (data ?? []).map(f => ({
    id: f.id, nome: f.nome, valor: num(f.valor), forma: f.forma, inicio: f.inicio, fim: f.fim, textoFatura: f.texto_fatura,
  }));
}

/** Nova conta fixa (regra 3). Crédito: texto_fatura é como ela aparece na fatura, pra ser reconhecida. */
export async function criarContaFixa(c: { nome: string; valor: number; forma: 'debito' | 'credito'; inicio: string; textoFatura: string | null }): Promise<void> {
  const { error } = await supabase.from('contas_fixas').insert({
    nome: c.nome.trim(), valor: c.valor, forma: c.forma, inicio: c.inicio, texto_fatura: c.forma === 'credito' ? c.textoFatura?.trim() || null : null,
  });
  if (error) throw error;
}

/** Encerrar: a conta conta até o mês informado (inclusive). */
export async function encerrarContaFixa(id: number, ultimoMes: string): Promise<void> {
  const { error } = await supabase.from('contas_fixas').update({ fim: ultimoMes }).eq('id', id);
  if (error) throw error;
}

/** Mudou o valor: encerra a antiga e cria uma nova a partir do mês (função no banco, regra 3). */
export async function mudarValorContaFixa(id: number, valor: number, aPartir: string): Promise<void> {
  const { error } = await supabase.rpc('mudar_valor_conta_fixa', { p_conta: id, p_valor: valor, p_a_partir: aPartir });
  if (error) throw error;
}

export type Conexao = {
  contas: string; status: string; execucao: string | null; avisos: string | null;
  ultimaAtualizacao: string | null;   // quando o Meu Pluggy buscou no banco
  sincronizadoEm: string | null;      // quando a nossa sincronização leu do Meu Pluggy
};

/** Status de cada banco conectado (gravado pela sincronização). */
export async function buscarConexoes(): Promise<Conexao[]> {
  const { data, error } = await supabase.from('conexoes')
    .select('contas, status, execucao, avisos, ultima_atualizacao, sincronizado_em').order('contas');
  if (error) throw error;
  return (data ?? []).map(c => ({
    contas: c.contas, status: c.status, execucao: c.execucao, avisos: c.avisos,
    ultimaAtualizacao: c.ultima_atualizacao, sincronizadoEm: c.sincronizado_em,
  }));
}

/** Um lançamento manual pra editar, com os dados que o formulário precisa. */
export type Editavel =
  | { tipo: 'renda'; id: number; competencia: string; fonte: string; valor: number }
  | { tipo: 'debito'; id: number; competencia: string; descricao: string; valor: number; parcelas: number; categoriaId: number | null; rateios: Rateio[] }
  | { tipo: 'gasolina'; id: number; data: string; valor: number; cartaoId: number };

export async function buscarEditavel(tipo: Lancado['tipo'], id: number): Promise<Editavel> {
  if (tipo === 'renda') {
    const { data, error } = await supabase.from('renda').select('competencia, fonte, valor').eq('id', id).single();
    if (error) throw error;
    return { tipo, id, competencia: data.competencia, fonte: data.fonte, valor: num(data.valor) };
  }
  if (tipo === 'debito') {
    const { data, error } = await supabase.from('debitos')
      .select('competencia_inicio, descricao, valor, parcelas, categoria_id, rateios(pessoa_id, valor, percentual)').eq('id', id).single();
    if (error) throw error;
    return {
      tipo, id, competencia: data.competencia_inicio, descricao: data.descricao, valor: num(data.valor), parcelas: data.parcelas,
      categoriaId: data.categoria_id,
      rateios: (data.rateios ?? []).map(r => ({ pessoa_id: r.pessoa_id, valor: r.valor === null ? null : num(r.valor), percentual: r.percentual === null ? null : num(r.percentual) })),
    };
  }
  const { data, error } = await supabase.from('abastecimentos').select('data, valor, cartao_id').eq('id', id).single();
  if (error) throw error;
  return { tipo, id, data: data.data, valor: num(data.valor), cartaoId: data.cartao_id };
}

export async function atualizarRenda(id: number, competencia: string, fonte: string, valor: number): Promise<void> {
  const { error } = await supabase.from('renda').update({ competencia, fonte: fonte.trim(), valor }).eq('id', id);
  if (error) throw error;
}

/** Débito + divisão (função editar_debito no banco). Parcelado: vale pra todas as parcelas. */
export async function atualizarDebito(id: number, competencia: string, descricao: string, valor: number, parcelas: number, categoriaId: number, rateios: Rateio[]): Promise<void> {
  const { error } = await supabase.rpc('editar_debito', {
    p_debito: id, p_competencia: competencia, p_descricao: descricao, p_valor: valor, p_parcelas: parcelas, p_categoria: categoriaId, p_rateios: rateios,
  });
  if (error) throw error;
}

export async function atualizarGasolina(id: number, data: string, valor: number, cartaoId: number): Promise<void> {
  const { error } = await supabase.from('abastecimentos').update({ data, valor, cartao_id: cartaoId }).eq('id', id);
  if (error) throw error;
}
