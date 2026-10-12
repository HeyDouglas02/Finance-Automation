/* ======================= API PLUGGY ======================= */

function apiKey_() {
  const p = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch(API + '/auth', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      clientId: p.getProperty('PLUGGY_CLIENT_ID'),
      clientSecret: p.getProperty('PLUGGY_CLIENT_SECRET'),
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Autenticação falhou (' + res.getResponseCode() + '): ' + res.getContentText());
  }
  return JSON.parse(res.getContentText()).apiKey;
}

function get_(path, key) {
  const res = UrlFetchApp.fetch(API + path, { headers: { 'X-API-KEY': key }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error(path + ' -> ' + res.getResponseCode() + ': ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function buscaTransacoes_(accountId, desde, key) {
  const out = [];
  let path = '/v2/transactions?accountId=' + accountId +
    '&dateFrom=' + desde;
  while (path) {
    const r = get_(path, key);
    (r.results || []).forEach(t => {
      // compras internacionais: "amount" vem na moeda original (ex.: dólar);
      // o valor cobrado em reais fica em amountInAccountCurrency
      if (t.amountInAccountCurrency != null && t.currencyCode && t.currencyCode !== 'BRL') {
        t.valorOriginal = t.amount + ' ' + t.currencyCode;
        t.amount = t.amountInAccountCurrency;
      }
      out.push(t);
    });
    path = r.next ? '/v2/transactions' + r.next : null;
  }
  return out;
}

/**
 * Faturas do cartão: total, encargos (IOF, juros, multa) e pagamentos.
 * Ler da Pluggy não consome o limite do Open Finance (quem busca no banco é a Pluggy, 1x por dia).
 */
function atualizaFaturas_(acc, conta, faturas, key) {
  try {
    (get_('/bills?accountId=' + acc.id, key).results || []).forEach(b => {
      const encargos = (b.financeCharges || []).reduce((t, c) => t + (Number(c.amount) || 0), 0);
      faturas[b.id] = { conta: conta, venc: ymd_(b.dueDate), total: r2_(b.totalAmount), encargos: r2_(encargos) };
    });
  } catch (e) {
    console.warn('Faturas indisponíveis para ' + conta + ': ' + e);
  }
}

/** Situação da conexão com o banco (status do item na Pluggy). */
function statusItem_(itemId, key) {
  const st = { itemId: itemId, contas: [], status: '', execucao: '', ultima: '', avisos: [] };
  try {
    const it = get_('/items/' + itemId, key);
    st.status = it.status || '';
    st.execucao = it.executionStatus || '';
    st.ultima = it.lastUpdatedAt || '';
    const det = it.statusDetail || {};
    Object.keys(det).forEach(prod => {
      ((det[prod] && det[prod].warnings) || []).forEach(w => st.avisos.push(prod + ': ' + (w.message || w.code)));
    });
    if (it.error && it.error.message) st.avisos.push(it.error.message);
  } catch (e) {
    st.status = 'ERRO';
    st.avisos.push(String(e).slice(0, 200));
  }
  return st;
}
