// Edge Function: sincroniza cartões, faturas e transações da Pluggy com o banco.
// Chamada todo dia pelo pg_cron (migration 003) ou manualmente.
//
// Secrets necessários (supabase secrets set):
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS (separados por vírgula)
//   CRON_SECRET (exigido no cabeçalho x-cron-secret de toda chamada)
// Publicar com: supabase functions deploy sync-pluggy --use-api --no-verify-jwt
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do próprio Supabase.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  achaRegra, competencia, dataLocal, ehPagamentoFatura, ehTaxa, grupoParcela,
  mesmaCompra, Regra, valorEmReais,
} from './regras.ts';

const PLUGGY = 'https://api.pluggy.ai';
const JANELA_DIAS = 45;

Deno.serve(async (req) => {
  // Só roda com o segredo certo no cabeçalho (o agendador manda; quem não tiver recebe 401)
  const segredo = Deno.env.get('CRON_SECRET');
  if (!segredo || !iguais(req.headers.get('x-cron-secret') ?? '', segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const resumo = await sincronizar(db);
    return Response.json(resumo);
  } catch (e) {
    console.error(e);
    return Response.json({ erro: String(e) }, { status: 500 });
  }
});

/** Compara dois textos sempre no mesmo tempo (evita adivinhar o segredo medindo a demora). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/* ------------------------------ Pluggy ------------------------------ */

async function pluggyKey(): Promise<string> {
  const r = await fetch(`${PLUGGY}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: Deno.env.get('PLUGGY_CLIENT_ID'), clientSecret: Deno.env.get('PLUGGY_CLIENT_SECRET') }),
  });
  if (!r.ok) throw new Error(`Pluggy auth ${r.status}: ${await r.text()}`);
  return (await r.json()).apiKey;
}

async function pluggyGet(path: string, key: string) {
  const r = await fetch(`${PLUGGY}${path}`, { headers: { 'X-API-KEY': key } });
  if (!r.ok) throw new Error(`Pluggy ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function transacoesDaConta(accountId: string, desde: string, key: string) {
  const out: any[] = [];
  let path: string | null = `/v2/transactions?accountId=${accountId}&dateFrom=${desde}`;
  while (path) {
    const r = await pluggyGet(path, key);
    out.push(...(r.results ?? []));
    path = r.next ? `/v2/transactions${r.next}` : null;
  }
  return out;
}

/* ---------------------------- Sincronização ---------------------------- */

/** Resultado de uma consulta ao banco: devolve os dados ou para com uma mensagem clara. */
function ler<T>(res: { data: T | null; error: { message: string } | null }, tabela: string): T {
  if (res.error) throw new Error(`Ler ${tabela}: ${res.error.message}`);
  if (res.data == null) throw new Error(`Ler ${tabela}: nenhum dado retornado`);
  return res.data;
}

async function sincronizar(db: SupabaseClient) {
  const key = await pluggyKey();
  const itemIds = (Deno.env.get('PLUGGY_ITEM_IDS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const desde = new Date(Date.now() - JANELA_DIAS * 864e5).toISOString().slice(0, 10);
  const resumo = { novas: 0, atualizadas: 0, herdadas: 0, substituidas: 0, faturas: 0 };

  // cadastros
  const cartoes = ler(await db.from('cartoes').select('id, nome, dia_fechamento, pluggy_account_id').eq('conectado', true), 'cartoes');
  const categorias = ler(await db.from('categorias').select('id, nome'), 'categorias');
  const regras = ler(await db.from('regras_categoria').select('texto, categoria_id, divisao_padrao, valor').order('prioridade'), 'regras_categoria');
  const pessoas = ler(await db.from('pessoas').select('id, nome'), 'pessoas');
  const catId = (nome: string) => categorias.find(c => c.nome === nome)?.id ?? null;
  const pessoaId = (nome: string) => pessoas.find(p => p.nome === nome)?.id ?? null;

  for (const itemId of itemIds) {
    // status da conexão
    const item = await pluggyGet(`/items/${itemId}`, key).catch(e => ({ status: 'ERRO', error: { message: String(e) } }));
    const avisos: string[] = [];
    Object.entries(item.statusDetail ?? {}).forEach(([prod, det]: [string, any]) =>
      (det?.warnings ?? []).forEach((w: any) => avisos.push(`${prod}: ${w.message ?? w.code}`)));
    if (item.error?.message) avisos.push(item.error.message);
    const nomesContas: string[] = [];

    const contas = (await pluggyGet(`/accounts?itemId=${itemId}`, key)).results ?? [];
    for (const acc of contas.filter((a: any) => a.type === 'CREDIT')) {
      const cartao = cartoes.find(c => c.pluggy_account_id === acc.id) ?? cartoes.find(c => c.nome === acc.name);
      if (!cartao) { avisos.push(`Cartão sem cadastro: ${acc.name}`); continue; }
      nomesContas.push(cartao.nome);
      if (!cartao.pluggy_account_id) {
        await db.from('cartoes').update({ pluggy_account_id: acc.id }).eq('id', cartao.id);
      }

      // faturas
      const bills = (await pluggyGet(`/bills?accountId=${acc.id}`, key)).results ?? [];
      const vencimentoDa: Record<string, string> = {};
      const linhasFatura = bills.map((b: any) => {
        vencimentoDa[b.id] = dataLocal(b.dueDate)!;
        return {
          id: b.id, cartao_id: cartao.id, vencimento: vencimentoDa[b.id], total: b.totalAmount,
          encargos: (b.financeCharges ?? []).reduce((t: number, c: any) => t + (Number(c.amount) || 0), 0),
          atualizado_em: new Date().toISOString(),
        };
      });
      if (linhasFatura.length) { const { error } = await db.from('faturas').upsert(linhasFatura); if (error) throw new Error(`Gravar faturas: ${error.message}`); }
      resumo.faturas += linhasFatura.length;

      // transações
      const txs = await transacoesDaConta(acc.id, desde, key);
      const r = await processarTransacoes(db, cartao, txs, vencimentoDa, desde, regras as Regra[], catId, pessoaId);
      resumo.novas += r.novas; resumo.atualizadas += r.atualizadas;
      resumo.herdadas += r.herdadas; resumo.substituidas += r.substituidas;
    }

    await db.from('conexoes').upsert({
      item_id: itemId, contas: nomesContas.join(', ') || itemId, status: item.status ?? null,
      execucao: item.executionStatus ?? null, ultima_atualizacao: item.lastUpdatedAt ?? null,
      avisos: avisos.join(' | ') || null, sincronizado_em: new Date().toISOString(),
    });
  }
  return resumo;
}

async function processarTransacoes(
  db: SupabaseClient, cartao: { id: number; nome: string; dia_fechamento: number },
  txs: any[], vencimentoDa: Record<string, string>, desde: string, regras: Regra[],
  catId: (n: string) => number | null, pessoaId: (n: string) => number | null,
) {
  const r = { novas: 0, atualizadas: 0, herdadas: 0, substituidas: 0 };

  // 1) transforma o que veio da Pluggy no formato da tabela
  const vindas = txs.map(t => {
    const data = dataLocal(t.date)!;
    const m = t.creditCardMetadata ?? {};
    const billId = m.billId ?? null;
    return {
      id: t.id, cartao_id: cartao.id, data, descricao: t.description, valor: valorEmReais(t),
      status: t.status === 'PENDING' ? 'PENDING' : 'POSTED',
      tipo: ehPagamentoFatura(t.description, t.category) ? 'ignorado' : 'gasto',
      parcela_num: m.totalInstallments > 1 ? m.installmentNumber : null,
      parcela_total: m.totalInstallments > 1 ? m.totalInstallments : null,
      compra_original: m.purchaseDate ? dataLocal(m.purchaseDate) : null,
      fatura_id: billId, cartao_final: m.cardNumber ?? null,
      competencia: competencia(data, billId ? vencimentoDa[billId] ?? null : null, cartao.dia_fechamento),
      atualizado_em: new Date().toISOString(),
      _categoriaPluggy: t.category,
    };
  });
  const ids = vindas.map(v => v.id);

  // 2) separa novas x já existentes
  const existentes = ids.length
    ? ler(await db.from('transacoes').select('id').in('id', ids), 'transacoes') : [] as { id: string }[];
  const jaExiste = new Set((existentes ?? []).map(e => e.id));

  // existentes: atualiza só os dados do banco (a classificação é preservada)
  const atualizar = vindas.filter(v => jaExiste.has(v.id)).map(({ _categoriaPluggy, ...v }) => v);
  if (atualizar.length) { const { error } = await db.from('transacoes').upsert(atualizar); if (error) throw new Error(`Atualizar transações: ${error.message}`); }
  r.atualizadas = atualizar.length;

  // 3) pendentes que sumiram (viraram lançamento definitivo com outro ID)
  const pendentesAntigas = ler(await db.from('transacoes')
    .select('id, cartao_id, valor, data, categoria_id, revisado, observacao, rateios(pessoa_id, valor, percentual)')
    .eq('cartao_id', cartao.id).eq('status', 'PENDING').gte('data', desde), 'transacoes pendentes');
  const sumiram = (pendentesAntigas ?? []).filter(p => !ids.includes(p.id));

  // 4) novas: classifica, herda e insere
  const novas = vindas.filter(v => !jaExiste.has(v.id));
  for (const v of novas) {
    const { _categoriaPluggy, ...linha } = v as any;
    let categoria_id: number | null = null;
    let revisado = false;
    let observacao: string | null = null;
    let rateios: { pessoa_id: number; valor: number | null; percentual: number | null }[] = [];

    if (linha.tipo === 'ignorado') {
      revisado = true;
    } else if (ehTaxa(linha.descricao, _categoriaPluggy)) {
      categoria_id = catId('Taxas'); revisado = true;
    } else {
      // a) era uma pendente que mudou de ID? herda tudo dela
      const antiga = sumiram.find(p => mesmaCompra(p as any, linha));
      // b) é uma parcela? herda da parcela anterior já revisada
      const anterior = !antiga && linha.parcela_total
        ? await parcelaAnterior(db, cartao.id, linha) : null;

      const origem = antiga ?? anterior;
      if (origem && (origem.revisado || (origem.rateios ?? []).length)) {
        categoria_id = origem.categoria_id; revisado = true;
        observacao = antiga ? antiga.observacao : null;
        rateios = (origem.rateios ?? []).map((x: any) => ({ pessoa_id: x.pessoa_id, valor: x.valor, percentual: x.percentual }));
        if (antiga) { sumiram.splice(sumiram.indexOf(antiga), 1); r.substituidas++; await db.from('transacoes').delete().eq('id', antiga.id); }
        else r.herdadas++;
      } else {
        // c) regra de categoria (com divisão padrão, se houver); sem regra fica sem categoria (pendente)
        const regra = achaRegra(linha.descricao, linha.valor, regras);
        categoria_id = regra?.categoria_id ?? null;
        if (Array.isArray(regra?.divisao_padrao)) {
          rateios = (regra!.divisao_padrao as any[]).map(d => ({
            pessoa_id: pessoaId(d.pessoa)!, valor: d.valor ?? null, percentual: d.percentual ?? null,
          })).filter(x => x.pessoa_id);
        }
      }
    }

    const { error } = await db.from('transacoes').insert({ ...linha, categoria_id, revisado, observacao });
    if (error) throw new Error(`Inserir ${linha.id}: ${error.message}`);
    if (rateios.length) await db.from('rateios').insert(rateios.map(x => ({ ...x, transacao_id: linha.id })));
    r.novas++;
  }

  // 5) pendentes que sumiram e não viraram nada: o banco cancelou, então saem também
  for (const p of sumiram) await db.from('transacoes').delete().eq('id', p.id);
  return r;
}

/** Última parcela anterior da mesma compra (mesmo cartão, descrição, total e mês da compra). */
async function parcelaAnterior(db: SupabaseClient, cartaoId: number, linha: any) {
  const { data } = await db.from('transacoes')
    .select('id, descricao, compra_original, parcela_num, categoria_id, revisado, rateios(pessoa_id, valor, percentual)')
    .eq('cartao_id', cartaoId).eq('parcela_total', linha.parcela_total).lt('parcela_num', linha.parcela_num)
    .order('parcela_num', { ascending: false });
  const alvo = grupoParcela(cartaoId, linha.descricao, linha.parcela_total, linha.compra_original);
  return (data ?? []).find(d => grupoParcela(cartaoId, d.descricao, linha.parcela_total, d.compra_original) === alvo) ?? null;
}
