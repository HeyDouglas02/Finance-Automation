/* ======================= LEITURA / ESCRITA ======================= */

function lerTransacoes_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Transacoes');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, KEYS.length).getValues()
    .filter(l => l[K.id])
    .map(l => {
      const r = {};
      KEYS.forEach((k, i) => { r[k] = l[i]; });
      r.data = ymd_(r.data);
      r.valor = Number(r.valor) || 0;
      r.revisado = r.revisado === true;
      ['conta', 'descricao', 'categoria', 'responsavel', 'divisao', 'observacao', 'competencia', 'tipo',
        'parcela', 'status', 'cartao', 'compra_original', 'chave_parcela', 'billId', 'id']
        .forEach(k => { r[k] = r[k] == null ? '' : String(r[k]); });
      return r;
    });
}

function salvaTransacoes_(linhas, cfg) {
  const sh = aba_('Transacoes');
  linhas.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  const n = linhas.length, w = KEYS.length;
  sh.clearContents();
  sh.getRange(1, 1, 1, w).setValues([HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (!n) return;
  TEXTO.forEach(k => sh.getRange(2, K[k] + 1, n, 1).setNumberFormat('@'));
  sh.getRange(2, K.valor + 1, n, 1).setNumberFormat('#,##0.00');
  sh.getRange(2, K.minha_parte + 1, n, 1).setNumberFormat('#,##0.00');
  sh.getRange(2, 1, n, w).setValues(linhas.map(r => KEYS.map(k => {
    if (k === 'data') return dateCell_(r.data);
    if (k === 'revisado') return r.revisado === true;
    return r[k] == null ? '' : r[k];
  })));

  const cats = Array.from(new Set(CATEGORIAS_BASE.concat(cfg.categorias.map(c => c[1])))).filter(String);
  const pessoas = ['Eu'].concat(Array.from(new Set(cfg.pessoas.map(p => p[1]))).filter(String));
  sh.getRange(2, K.categoria + 1, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(cats, true).setAllowInvalid(true).build());
  sh.getRange(2, K.responsavel + 1, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(pessoas, true).setAllowInvalid(true).build());
  sh.getRange(2, K.revisado + 1, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().build());
  const sobra = sh.getMaxRows() - (n + 1);
  if (sobra > 0) sh.getRange(n + 2, 1, sobra, w).clearDataValidations();
  visualTransacoes_(sh, n, w);
}

function visualTransacoes_(sh, n, w) {
  // colunas técnicas (Status em diante) ficam ocultas
  sh.showColumns(1, w);
  sh.hideColumns(K.status + 1, w - K.status);
  // filtro: esconde as linhas Ignoradas (dá pra mudar no ícone do filtro)
  const f = sh.getFilter();
  if (f) f.remove();
  sh.getRange(1, 1, n + 1, w).createFilter().setColumnFilterCriteria(K.tipo + 1,
    SpreadsheetApp.newFilterCriteria().setHiddenValues(['Ignorado']).build());
  // pendentes de revisão em destaque
  const col = String.fromCharCode(65 + K.revisado);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + col + '2=FALSE')
      .setBackground('#fff4cc').setFontColor('#000000')
      .setRanges([sh.getRange(2, 1, n, K.observacao + 1)]).build(),
  ]);
  sh.setColumnWidth(K.descricao + 1, 320);
}

const FAT_HEAD = ['Conta', 'Vencimento', 'Competência', 'Total do banco', 'Soma das transações',
  'Encargos da fatura', 'Diferença', 'Pago', 'Situação', 'ID da fatura'];

function lerFaturas_() {
  const out = {};
  const sh = SpreadsheetApp.getActive().getSheetByName('Faturas');
  if (!sh || sh.getLastRow() < 2) return out;
  const w = sh.getLastColumn();
  const cab = sh.getRange(1, 1, 1, w).getValues()[0].map(String);
  const iId = cab.indexOf('ID da fatura'), iEnc = cab.indexOf('Encargos da fatura');
  if (iId < 0) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues().forEach(l => {
    if (l[iId]) out[String(l[iId])] = { conta: String(l[0]), venc: ymd_(l[1]), total: Number(l[3]) || 0,
      encargos: iEnc >= 0 ? Number(l[iEnc]) || 0 : 0 };
  });
  return out;
}

function salvaFaturas_(faturas, linhas, cfg) {
  const soma = {};
  linhas.forEach(r => {
    if (r.billId && r.tipo !== 'Ignorado') soma[r.billId] = r2_((soma[r.billId] || 0) + r.valor);
  });
  // pagamentos de fatura (linhas ignoradas) por cartão
  const pagamentos = linhas.filter(r => r.tipo === 'Ignorado' && /^Pagamento de fatura/.test(r.observacao));
  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const somaDias = (ymd, n) => Utilities.formatDate(new Date(new Date(ymd + 'T12:00:00Z').getTime() + n * 864e5), TZ, 'yyyy-MM-dd');

  // faturas que vencem antes disso têm compras anteriores à 1ª carga: não dá para conferir
  const primeira = (cfg.geral.PRIMEIRA_CARGA_DESDE || '2000-01-01').slice(0, 7);
  const conferirDesde = ymAdd_(primeira, 2) + '-01';
  const rows = Object.keys(faturas).map(id => {
    const f = faturas[id];
    const comp = ymAdd_(f.venc.slice(0, 7), -1);
    const ini = somaDias(f.venc, -20), fim = somaDias(f.venc, 25);
    const pago = r2_(pagamentos.filter(p => p.conta === f.conta && p.data >= ini && p.data <= fim)
      .reduce((t, p) => t + Math.abs(p.valor), 0));
    let sit;
    if (ini < (cfg.geral.PRIMEIRA_CARGA_DESDE || '2000-01-01')) sit = '— (antes da 1ª carga)';
    else if (f.total <= 0.01) sit = '✅ Nada a pagar';
    else if (pago >= f.total - 0.01) sit = '✅ Paga';
    else if (pago > 0) sit = '🟡 Paga em parte (falta ' + brl_(f.total - pago) + ')';
    else if (f.venc < hoje) sit = '⚠ Pagamento não identificado';
    else sit = '⏳ A vencer';
    const s = soma[id] || 0;
    const conferivel = f.venc >= conferirDesde;
    return [f.conta, f.venc, comp, f.total, conferivel ? s : '', f.encargos || 0,
      conferivel ? r2_(f.total - s) : '', pago, sit, id];
  }).sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));

  const sh = aba_('Faturas');
  sh.clearContents();
  sh.getRange(1, 1, 1, FAT_HEAD.length).setValues([FAT_HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (!rows.length) return;
  [2, 3, 10].forEach(c => sh.getRange(2, c, rows.length, 1).setNumberFormat('@'));
  sh.getRange(2, 4, rows.length, 5).setNumberFormat('#,##0.00');
  sh.getRange(2, 1, rows.length, FAT_HEAD.length).setValues(rows);
}
