/* ======================= DIVISÃO E ACERTOS ======================= */

function canonPessoa_(nome, cfg) {
  const n = norm_(nome);
  if (!n || n === 'EU') return 'Eu';
  const achou = cfg.pessoas.map(p => p[1]).filter(String).find(p => norm_(p) === n);
  return achou || String(nome).trim();
}

/** "Mãe 100; Eu 30,26" | "Duda 50%" | vazio → { pessoa: valor }. O que sobrar vai para "Eu". */
function partes_(r, cfg) {
  const out = {};
  const valor = Number(r.valor) || 0;
  const div = String(r.divisao || '').trim();
  if (!div) {
    out[canonPessoa_(r.responsavel || 'Eu', cfg)] = valor;
    return out;
  }
  let resto = valor;
  div.split(/[;\n]+/).forEach(parte => {
    const m = parte.trim().match(/^(.+?)\s+(-?[\d.,]+)\s*(%?)$/);
    if (!m) return;
    const nome = canonPessoa_(m[1], cfg);
    const v = m[3] ? r2_(valor * num_(m[2]) / 100) : num_(m[2]);
    if (isNaN(v)) return;
    out[nome] = r2_((out[nome] || 0) + v);
    resto = r2_(resto - v);
  });
  if (Math.abs(resto) >= 0.005) out.Eu = r2_((out.Eu || 0) + resto);
  return out;
}

function geraAcertos_(linhas, cfg) {
  const desde = cfg.geral.ACERTOS_DESDE || '0000-00';
  const pgDesde = cfg.geral.PAGAMENTOS_DESDE || '0000-00-00';
  const cobr = cfg.geral.COBRANCA_COMPETENCIA ||
    ymAdd_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM'), -1);

  const inicial = {};
  cfg.pessoas.forEach(p => {
    if (p[1] && String(p[2]).trim() !== '' && !isNaN(num_(p[2]))) inicial[p[1]] = num_(p[2]);
  });
  const mov = {}, itens = {};
  linhas.forEach(r => {
    if (r.tipo === 'Ignorado') return;
    const entrada = r.tipo === 'Entrada';
    if (entrada ? r.data < pgDesde : r.competencia < desde) return;
    const ps = partes_(r, cfg);
    Object.keys(ps).forEach(p => {
      if (p === 'Eu') return;
      mov[p] = mov[p] || {};
      const m = mov[p][r.competencia] = mov[p][r.competencia] || { deve: 0, pagou: 0 };
      if (entrada) m.pagou = r2_(m.pagou + ps[p]);
      else m.deve = r2_(m.deve + ps[p]);
      if (!entrada && r.competencia === cobr) {
        (itens[p] = itens[p] || []).push([r.data, r.descricao, r.conta, r.parcela, ps[p]]);
      }
    });
  });

  const pessoas = Array.from(new Set(cfg.pessoas.map(p => p[1]).filter(String).concat(Object.keys(mov))));
  const out = [];
  out.push(['SALDO ATUAL (positivo = a pessoa te deve)']);
  out.push(['Pessoa', 'Saldo inicial', 'Total devido', 'Total pago', 'Saldo atual']);
  const saldoAtual = {};
  pessoas.forEach(p => {
    let deve = 0, pagou = 0;
    Object.keys(mov[p] || {}).forEach(c => { deve += mov[p][c].deve; pagou += mov[p][c].pagou; });
    const ini = inicial[p] || 0;
    saldoAtual[p] = r2_(ini + deve - pagou);
    out.push([p, ini, r2_(deve), r2_(pagou), saldoAtual[p]]);
  });
  out.push([]);
  out.push(['POR COMPETÊNCIA']);
  out.push(['Pessoa', 'Competência', 'Devido', 'Pago', 'Saldo acumulado']);
  pessoas.forEach(p => {
    let acum = inicial[p] || 0;
    Object.keys(mov[p] || {}).sort().forEach(c => {
      acum = r2_(acum + mov[p][c].deve - mov[p][c].pagou);
      out.push([p, c, mov[p][c].deve, mov[p][c].pagou, acum]);
    });
  });
  out.push([]);
  out.push(['COBRANÇA DA COMPETÊNCIA ' + cobr]);
  pessoas.forEach(p => {
    const lista = (itens[p] || []).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (!lista.length) return;
    const total = r2_(lista.reduce((s, i) => s + i[4], 0));
    const msg = 'Oi! Fechamento de ' + cobr + ': ' +
      lista.map(i => i[1] + (i[3] ? ' (' + i[3] + ')' : '') + ' ' + brl_(i[4])).join(', ') +
      '. Total do mês: ' + brl_(total) + '. Saldo em aberto: ' + brl_(saldoAtual[p]) + '.';
    out.push([]);
    out.push([p, 'Total: ' + brl_(total), 'Mensagem pronta →', msg]);
    out.push(['Data', 'Descrição', 'Conta', 'Parcela', 'Valor']);
    lista.forEach(i => out.push(i));
  });

  const w = 5;
  const vals = out.map(l => {
    const x = l.slice(0, w).map(v => (typeof v === 'number' ? v : "'" + String(v)));
    while (x.length < w) x.push('');
    return x;
  });
  const sh = aba_('Acertos');
  sh.clearContents();
  sh.getRange(1, 1, vals.length, w).setNumberFormat('#,##0.00').setValues(vals);
  sh.getRange(1, 1, vals.length, 1).setFontWeight('bold');
}
