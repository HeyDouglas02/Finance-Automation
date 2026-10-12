/* ======================= LANÇAMENTOS (tabela central) ======================= */
/*
 * Junta tudo numa tabela só, com os mesmos campos, um registro por valor e por mês do orçamento.
 * Fontes: Transacoes (cartão), Contas fixas, Débito, Gasolina e Renda.
 * Status:  Real (veio do banco) · Previsto (ainda não cobrado) · Esperado (débito, valor da lista) · Manual (lançado por você)
 */
const LANC_HEAD = ['Mês', 'Tipo', 'Descrição', 'Valor', 'Minha parte', 'Categoria', 'Responsável',
  'Divisão', 'Status', 'Divergência', 'Origem', 'Data', 'Ref'];

function geraLancamentos_(linhas, cfg) {
  const desde = cfg.geral.ACERTOS_DESDE || '2000-01';
  const ate = ymAdd_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM'), 12);
  const out = [];
  const divisoes = []; // parte de cada pessoa (exceto você) em cada lançamento
  const add = o => {
    if (o.mes < desde || o.mes > ate) return;
    if (o.tipo !== 'Renda') {
      const ps = partes_(o, cfg);
      Object.keys(ps).forEach(p => {
        if (p !== 'Eu' && ps[p]) {
          divisoes.push([o.mes, p, o.descricao, r2_(ps[p]), o.tipo, o.status, o.origem || '', o.ref || '']);
        }
      });
    }
    const minha = o.tipo === 'Renda' ? o.valor : r2_(partes_(o, cfg).Eu || 0);
    out.push([o.mes, o.tipo, o.descricao, r2_(o.valor), minha, o.categoria || '', o.responsavel || 'Eu',
      o.divisao || '', o.status, o.divergencia || '', o.origem || '', o.data || '', o.ref || '']);
  };

  // 1) Cartão: compras, parcelas (reais e previstas) e contas fixas cobradas no cartão
  const fixasCobradas = {}; // mes -> [linhas com categoria Conta fixa]
  const valorParcela = {};  // chave|n -> valor, para achar divergência entre parcelas
  linhas.forEach(r => { if (r.parcela) valorParcela[r.chave_parcela + '|' + String(r.parcela).split('/')[0]] = r.valor; });
  linhas.forEach(r => {
    if (r.tipo !== 'Gasto') return;
    const previsto = r.status === 'PREVISTO';
    let tipo = r.parcela ? 'Parcela' : 'Cartão';
    if (r.categoria === 'Conta fixa') {
      tipo = 'Conta fixa';
      (fixasCobradas[r.competencia] = fixasCobradas[r.competencia] || []).push(r);
    }
    let div = '';
    if (r.parcela && !previsto) {
      const n = Number(String(r.parcela).split('/')[0]);
      const ant = valorParcela[r.chave_parcela + '|' + (n - 1)];
      if (ant != null && Math.abs(ant - r.valor) > 0.05) div = 'Parcela anterior: ' + brl_(ant);
    }
    add({ mes: r.competencia, tipo: tipo, descricao: r.descricao + (r.parcela ? ' ' + r.parcela : ''),
      valor: r.valor, categoria: r.categoria, responsavel: r.responsavel, divisao: r.divisao,
      status: previsto ? 'Previsto' : 'Real', divergencia: div, origem: r.conta, data: r.data, ref: r.id, _r: r });
  });

  // 2) Contas fixas: previsão em cada mês de vigência, trocada pela cobrança real quando aparecer
  lerAba_('Contas fixas').forEach((l, i) => {
    const nome = String(l[0] || '').trim();
    const valor = Number(l[1]) || 0;
    if (!nome || !valor) return;
    const forma = norm_(l[2]);
    const ini = ymCel_(l[4]) || desde;
    const fim = ymCel_(l[5]) || ate;
    const texto = norm_(l[6]);
    for (let m = ini > desde ? ini : desde; m <= fim && m <= ate; m = ymAdd_(m, 1)) {
      if (forma === 'CREDITO') {
        const cand = (fixasCobradas[m] || []).filter(r => !r._usada && (!texto || norm_(r.descricao).indexOf(texto) >= 0));
        if (cand.length) {
          const real = cand.sort((a, b) => Math.abs(a.valor - valor) - Math.abs(b.valor - valor))[0];
          real._usada = true;
          if (Math.abs(real.valor - valor) >= 0.01) {
            const lin = out.find(o => o[12] === real.id);
            if (lin) lin[9] = 'Esperado ' + brl_(valor);
          }
          continue;
        }
        add({ mes: m, tipo: 'Conta fixa', descricao: nome, valor: valor, categoria: 'Conta fixa',
          status: 'Previsto', origem: 'Contas fixas', ref: 'fixa|' + (i + 2) + '|' + m });
      } else {
        add({ mes: m, tipo: 'Conta fixa', descricao: nome, valor: valor, categoria: 'Conta fixa',
          status: 'Esperado', origem: 'Contas fixas (débito)', ref: 'fixa|' + (i + 2) + '|' + m });
      }
    }
  });

  // 3) Débito: avulso ou parcelado (gera um lançamento por mês)
  lerAba_('Débito').forEach((l, i) => {
    const mes = ymCel_(l[0]);
    const valor = Number(l[2]) || 0;
    if (!mes || !valor) return;
    const n = Number(l[4]) || 1;
    for (let k = 0; k < n; k++) {
      add({ mes: ymAdd_(mes, k), tipo: 'Débito', descricao: String(l[1]) + (n > 1 ? ' (' + (k + 1) + ' de ' + n + ')' : ''),
        valor: valor, categoria: String(l[3] || ''), responsavel: String(l[6] || 'Eu'), divisao: String(l[7] || ''),
        status: 'Manual', origem: 'Débito', ref: 'deb|' + (i + 2) + '|' + k });
    }
  });

  // 4) Gasolina: conta no mês anterior ao vencimento (coluna "Conta no mês", calculada na aba)
  lerAba_('Gasolina').forEach((l, i) => {
    const mes = ymCel_(l[4]);
    const valor = Number(l[1]) || 0;
    if (!mes || !valor) return;
    add({ mes: mes, tipo: 'Gasolina', descricao: 'Gasolina ' + String(l[2] || ''), valor: valor,
      categoria: 'Gasolina', responsavel: String(l[5] || 'Eu'), divisao: String(l[6] || ''),
      status: 'Manual', origem: 'Gasolina', data: ymdCel_(l[0]), ref: 'gas|' + (i + 2) });
  });

  // 5) Renda
  lerAba_('Renda').forEach((l, i) => {
    const mes = ymCel_(l[0]);
    const valor = Number(l[2]) || 0;
    if (!mes || !valor) return;
    add({ mes: mes, tipo: 'Renda', descricao: String(l[1] || ''), valor: valor, categoria: 'Renda',
      status: 'Manual', origem: 'Renda', ref: 'renda|' + (i + 2) });
  });

  const ordemTipo = { 'Renda': 0, 'Conta fixa': 1, 'Parcela': 2, 'Cartão': 3, 'Débito': 4, 'Gasolina': 5 };
  out.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1)
    : ordemTipo[a[1]] !== ordemTipo[b[1]] ? ordemTipo[a[1]] - ordemTipo[b[1]]
    : String(a[11]) < String(b[11]) ? -1 : 1));

  salvaDivisoes_(divisoes);

  const sh = aba_('Lancamentos');
  sh.clearContents();
  sh.getRange(1, 1, 1, LANC_HEAD.length).setValues([LANC_HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (!out.length) return;
  sh.getRange(2, 1, out.length, 1).setNumberFormat('@');
  sh.getRange(2, 12, out.length, 2).setNumberFormat('@');
  sh.getRange(2, 4, out.length, 2).setNumberFormat('#,##0.00');
  sh.getRange(2, 1, out.length, LANC_HEAD.length).setValues(out.map(l => l.map((v, j) =>
    (j === 11 && v ? dateCell_(v) : v))));
  const sobra = sh.getMaxRows() - (out.length + 1);
  if (sobra > 0) sh.getRange(out.length + 2, 1, sobra, LANC_HEAD.length).clearContent();
}

const DIV_HEAD = ['Mês', 'Pessoa', 'Descrição', 'Valor', 'Tipo', 'Status', 'Origem', 'Ref'];

function salvaDivisoes_(linhas) {
  linhas.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const sh = aba_('Divisoes');
  sh.clearContents();
  sh.getRange(1, 1, 1, DIV_HEAD.length).setValues([DIV_HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (!linhas.length) return;
  sh.getRange(2, 1, linhas.length, 1).setNumberFormat('@');
  sh.getRange(2, 4, linhas.length, 1).setNumberFormat('#,##0.00');
  sh.getRange(2, 1, linhas.length, DIV_HEAD.length).setValues(linhas);
}

function lerAba_(nome) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

/** Célula de data (ou texto dd/MM/yyyy) → 'yyyy-MM'. */
function ymCel_(v) {
  const d = ymdCel_(v);
  return d ? d.slice(0, 7) : '';
}

function ymdCel_(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v) ? '' : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = ymd_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
