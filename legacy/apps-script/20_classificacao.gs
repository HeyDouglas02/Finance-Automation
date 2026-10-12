/* ======================= CLASSIFICAÇÃO ======================= */

function nomeConta_(acc) {
  return acc.subtype === 'SAVINGS_ACCOUNT' ? acc.name + ' (poupança)' : acc.name;
}

function montaLinha_(t, acc, cfg, faturas) {
  const c = classifica_(t, acc, cfg);
  const m = t.creditCardMetadata || {};
  const conta = nomeConta_(acc);
  const data = ymd_(t.date);
  const compra = m.purchaseDate ? ymd_(m.purchaseDate) : '';
  const parcela = m.totalInstallments > 1 ? m.installmentNumber + '/' + m.totalInstallments : '';
  const chave = parcela ? [conta, norm_(t.description), compra, m.totalInstallments].join('|') : '';
  let comp;
  if (acc.type === 'CREDIT') {
    const f = m.billId && faturas[m.billId];
    comp = f ? ymAdd_(f.venc.slice(0, 7), -1) : competenciaEstimada_(data, cfg.cartoes[conta]);
  } else {
    comp = data.slice(0, 7);
  }
  return {
    data: data, conta: conta, descricao: t.description, valor: r2_(c.valor),
    categoria: c.categoria, responsavel: c.responsavel, divisao: c.divisao || '',
    revisado: c.revisado, observacao: c.obs || '', competencia: comp, tipo: c.tipo,
    parcela: parcela, status: t.status || '', cartao: m.cardNumber || '',
    compra_original: compra, chave_parcela: chave, billId: m.billId || '', id: t.id,
  };
}

/** Competência = mês em que a fatura fecha (= mês anterior ao vencimento). */
function competenciaEstimada_(data, fechamento) {
  const fech = Number(fechamento) || 25;
  const dia = Number(data.slice(8, 10));
  return dia <= fech ? data.slice(0, 7) : ymAdd_(data.slice(0, 7), 1);
}

function classifica_(t, acc, cfg) {
  const d = norm_(t.description);
  const cat = t.category || '';
  const r = { tipo: 'Gasto', valor: 0, categoria: '', responsavel: 'Eu', divisao: '', revisado: false, obs: '' };
  const ignora = motivo => ({ tipo: 'Ignorado', valor: Math.abs(t.amount), categoria: '', responsavel: '',
    divisao: '', revisado: true, obs: motivo });

  if (acc.type === 'CREDIT') {
    r.valor = t.amount; // compra positiva, estorno negativo
    if (/PAG BOLETO|PAGTO DEBITO AUTOMATICO|PAGAMENTO ON LINE|PAGTO\. POR DEB|PAGAMENTO FATURA/.test(d) ||
        cat === 'Credit card payment' || cat === 'Transfer - Internal') {
      return ignora('Pagamento de fatura');
    }
    if (/\bIOF\b|JUROS|ENCARGOS|ANUIDADE|MULTA/.test(d) ||
        ['Interests charged', 'Bank fees', 'Tax on financial operations'].indexOf(cat) >= 0) {
      r.categoria = 'Taxas';
      r.revisado = true;
      return r;
    }
  } else {
    const entrada = t.amount > 0;
    r.valor = Math.abs(t.amount);
    if (/APLICACAO|RESG\/VENCTO|RESGATE|RENTAB|\bB3\b|CONTA GLOBAL|INVESTIMENTO/.test(d) ||
        ['Fixed income', 'Investments', 'Proceeds interests and dividends'].indexOf(cat) >= 0) {
      return ignora('Investimento');
    }
    if (/GASTOS CARTAO DE CREDITO|PAGAMENTO FATURA|COBRANCA - BANCO BRADESCO/.test(d)) {
      return ignora('Pagamento de fatura');
    }
    const meu = norm_(cfg.geral.MEU_NOME);
    const proprio = (meu && d.indexOf(meu) >= 0) || cat === 'Same person transfer';
    if (proprio && !entrada && /QR CODE/.test(d)) {
      r.categoria = 'A revisar';
      r.obs = 'Pix QR para você mesmo: cartão Mercado Pago?';
      return r;
    }
    if (proprio) return ignora('Transferência entre suas contas');

    const pessoa = achaPessoa_(d, cfg);
    if (entrada) {
      r.tipo = 'Entrada';
      if (pessoa) { r.responsavel = pessoa; r.categoria = 'Acerto'; return r; }
      const regra = achaRegra_(d, cfg);
      r.categoria = regra ? regra[1] : 'Entrada a classificar';
      return r;
    }
    if (pessoa) {
      r.categoria = 'A revisar';
      r.obs = 'Pix para ' + pessoa;
      return r;
    }
  }

  const regra = achaRegra_(d, cfg);
  if (regra) {
    r.categoria = regra[1];
    if (regra[2]) r.divisao = regra[2];
  } else {
    r.categoria = 'A revisar';
  }
  return r;
}

function achaRegra_(d, cfg) {
  for (let i = 0; i < cfg.categorias.length; i++) {
    const regra = cfg.categorias[i];
    if (regra[0] && d.indexOf(norm_(regra[0])) >= 0) return regra;
  }
  return null;
}

function achaPessoa_(d, cfg) {
  for (let i = 0; i < cfg.pessoas.length; i++) {
    const p = cfg.pessoas[i];
    if (p[0] && d.indexOf(norm_(p[0])) >= 0) return p[1];
  }
  return '';
}
