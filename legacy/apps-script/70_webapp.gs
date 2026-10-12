/* ======================= APP FINANCE (web app) ======================= */
/*
 * Serve a página "app" e expõe funções que a página chama (google.script.run).
 * Lê a planilha (Lancamentos, Divisoes, Transacoes, Conexoes) e grava nas abas de entrada.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('app')
    .setTitle('Finance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

const GRUPOS_APP = ['Conta fixa', 'Parcela', 'Cartão', 'Débito', 'Gasolina'];

function mesAtual_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
}

function lerLanc_() {
  return lerAba_('Lancamentos').filter(l => l[0]).map(l => ({
    mes: String(l[0]), tipo: String(l[1]), descricao: String(l[2]),
    valor: Number(l[3]) || 0, minha: Number(l[4]) || 0, categoria: String(l[5] || ''),
    responsavel: String(l[6] || ''), divisao: String(l[7] || ''), status: String(l[8] || ''),
    divergencia: String(l[9] || ''), origem: String(l[10] || ''), data: ymdCel_(l[11]),
  }));
}

/** Tudo que a tela inicial precisa, numa chamada só. */
function apiInicio() {
  return { mes: apiMes(mesAtual_()), status: apiStatus(), pendentes: contaPendentesApp_(), config: apiConfig() };
}

function apiConfig() {
  const cfg = lerCfg_();
  const cats = Array.from(new Set(CATEGORIAS_BASE.concat(cfg.categorias.map(c => c[1]))))
    .filter(c => c && ['Acerto', 'Entrada a classificar', 'Renda'].indexOf(c) < 0);
  const pessoas = ['Eu'].concat(Array.from(new Set(cfg.pessoas.map(p => p[1]).filter(String))));
  const cartoes = lerAba_('Cartões').filter(l => l[0]).map(l => ({
    nome: String(l[0]), conectado: norm_(l[1]) === 'SIM',
    fech: Number(l[2]) || 31, venc: Number(l[3]) || 10, meses: Number(l[4]) || 1,
  }));
  const fontes = Array.from(new Set(lerAba_('Renda').map(l => String(l[1] || '')).filter(String)));
  return { categorias: cats, pessoas: pessoas, cartoes: cartoes, fontes: fontes,
    planilha: SpreadsheetApp.getActive().getUrl() };
}

/* ---------- Mês ---------- */

function apiMes(ym) {
  ym = ym || mesAtual_();
  const ls = lerLanc_().filter(l => l.mes === ym);
  const rendaItens = ls.filter(l => l.tipo === 'Renda').map(l => ({ d: l.descricao, v: l.valor }));
  const renda = r2_(rendaItens.reduce((t, i) => t + i.v, 0));
  const grupos = GRUPOS_APP.map(g => {
    const itens = ls.filter(l => l.tipo === g).map(l => ({
      d: l.descricao, v: l.valor, m: l.minha, r: l.responsavel, div: l.divisao,
      s: l.status, x: l.divergencia, dt: l.data, o: l.origem,
    })).sort((a, b) => b.m - a.m || b.v - a.v);
    return { nome: g, total: r2_(itens.reduce((t, i) => t + i.m, 0)), itens: itens };
  });
  const saidas = r2_(grupos.reduce((t, g) => t + g.total, 0));
  return { ym: ym, atual: mesAtual_(), renda: renda, rendaItens: rendaItens,
    saidas: saidas, sobra: r2_(renda - saidas), grupos: grupos };
}

function apiMeses() {
  const ls = lerLanc_();
  const hoje = mesAtual_();
  const desde = lerCfg_().geral.ACERTOS_DESDE || hoje;
  const out = [];
  for (let m = desde; m <= ymAdd_(hoje, 4); m = ymAdd_(m, 1)) {
    const x = ls.filter(l => l.mes === m);
    const renda = r2_(x.filter(l => l.tipo === 'Renda').reduce((t, l) => t + l.valor, 0));
    const saidas = r2_(x.filter(l => l.tipo !== 'Renda').reduce((t, l) => t + l.minha, 0));
    out.push({ ym: m, renda: renda, saidas: saidas, sobra: r2_(renda - saidas) });
  }
  return { meses: out, atual: hoje };
}

/* ---------- Status das conexões ---------- */

function apiStatus() {
  const linhas = lerAba_('Conexoes');
  const bancos = [];
  let sync = '';
  linhas.forEach(l => {
    if (!l[0] && !l[1]) { sync = String(l[5] || ''); return; }
    const resumo = String(l[5] || '');
    bancos.push({ contas: String(l[0] || ''), status: String(l[1] || ''), ultima: String(l[3] || ''),
      avisos: String(l[4] || ''), nivel: resumo.indexOf('⚠') === 0 ? 'erro' : resumo.indexOf('🟡') === 0 ? 'aviso' : 'ok',
      resumo: resumo.replace(/^\S+\s/, '') });
  });
  return { bancos: bancos, sync: sync.replace('Planilha sincronizada em ', '') };
}

function apiSincronizar() {
  sincronizar();
  return { status: apiStatus(), pendentes: contaPendentesApp_() };
}

/* ---------- Revisar ---------- */

function pendentesApp_() {
  return lerTransacoes_().filter(r => r.tipo !== 'Ignorado' && r.revisado !== true &&
    r.status !== 'PREVISTO' && String(r.id).indexOf('prev|') !== 0);
}

function contaPendentesApp_() {
  return pendentesApp_().length;
}

function apiRevisar() {
  const pend = pendentesApp_().sort((a, b) => (a.data < b.data ? 1 : -1)).map(r => ({
    id: r.id, data: r.data, conta: r.conta, descricao: r.descricao, valor: r.valor,
    categoria: r.categoria, responsavel: r.responsavel || 'Eu', divisao: r.divisao,
    parcela: r.parcela, competencia: r.competencia,
  }));
  return { pendentes: pend };
}

function apiSalvarRevisao(id, categoria, responsavel, divisao) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Transacoes');
  const n = sh.getLastRow() - 1;
  const ids = sh.getRange(2, K.id + 1, n, 1).getValues();
  for (let i = 0; i < n; i++) {
    if (String(ids[i][0]) === String(id)) {
      // Categoria, Responsável, Divisão e Revisado são colunas vizinhas
      sh.getRange(i + 2, K.categoria + 1, 1, 4).setValues([[categoria, responsavel || 'Eu', divisao || '', true]]);
      return true;
    }
  }
  throw new Error('Não achei essa compra. Sincronize e tente de novo.');
}

function apiRecalcular() {
  recalcular();
  return apiMes(mesAtual_());
}

/* ---------- Lançar ---------- */

function proximaLinha_(sh) {
  const n = Math.max(sh.getLastRow(), 1);
  const col = sh.getRange(1, 1, n, 1).getValues();
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i][0] !== '' && col[i][0] !== null) return i + 2;
  }
  return 2;
}

function dataMes_(ym) {
  return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1, 12);
}

function dataDia_(ymd) {
  const p = String(ymd).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12);
}

function apiLancar(tipo, d) {
  const ss = SpreadsheetApp.getActive();
  const v = Number(d.valor);
  if (!(v > 0)) throw new Error('Informe um valor maior que zero.');
  if (tipo === 'renda') {
    if (!d.fonte) throw new Error('Informe de onde vem a renda.');
    const sh = ss.getSheetByName('Renda');
    sh.getRange(proximaLinha_(sh), 1, 1, 3).setValues([[dataMes_(d.mes), d.fonte, v]]);
  } else if (tipo === 'debito') {
    if (!d.descricao) throw new Error('Informe a descrição.');
    const sh = ss.getSheetByName('Débito');
    const r = proximaLinha_(sh);
    const parc = Number(d.parcelas) > 1 ? Number(d.parcelas) : '';
    sh.getRange(r, 1, 1, 5).setValues([[dataMes_(d.mes), d.descricao, v, d.categoria || '', parc]]);
    sh.getRange(r, 7, 1, 2).setValues([[d.responsavel || 'Eu', d.divisao || '']]);
  } else if (tipo === 'gasolina') {
    if (!d.cartao) throw new Error('Escolha o cartão.');
    const sh = ss.getSheetByName('Gasolina');
    const r = proximaLinha_(sh);
    sh.getRange(r, 1, 1, 3).setValues([[dataDia_(d.data), v, d.cartao]]);
    sh.getRange(r, 6).setValue(d.responsavel || 'Eu');
  } else if (tipo === 'pagamento') {
    if (!d.pessoa) throw new Error('Escolha quem pagou.');
    const sh = ss.getSheetByName('Pagamentos');
    sh.getRange(proximaLinha_(sh), 1, 1, 4).setValues([[dataMes_(d.mes), d.pessoa, v, dataDia_(d.data)]]);
    return true; // pagamentos não mudam os lançamentos
  } else {
    throw new Error('Tipo de lançamento desconhecido.');
  }
  recalcular();
  return true;
}

/* ---------- Acertos ---------- */

function apiAcertos(ym) {
  ym = ym || ymAdd_(mesAtual_(), -1);
  const pessoas = {};
  const pega = p => (pessoas[p] = pessoas[p] || { nome: p, deve: 0, pago: 0, itens: [], dataPag: '' });
  lerAba_('Divisoes').filter(l => String(l[0]) === ym).forEach(l => {
    const o = pega(String(l[1]));
    o.deve = r2_(o.deve + (Number(l[3]) || 0));
    o.itens.push({ d: String(l[2]), v: Number(l[3]) || 0, s: String(l[5] || '') });
  });
  lerAba_('Pagamentos').filter(l => ymCel_(l[0]) === ym).forEach(l => {
    const o = pega(String(l[1]));
    o.pago = r2_(o.pago + (Number(l[2]) || 0));
    o.dataPag = ymdCel_(l[3]);
  });
  const lista = Object.keys(pessoas).map(k => pessoas[k]).sort((a, b) => b.deve - a.deve);
  lista.forEach(p => p.itens.sort((a, b) => b.v - a.v));
  return { ym: ym, pessoas: lista,
    falta: r2_(lista.reduce((t, p) => t + Math.max(0, p.deve - p.pago), 0)) };
}
