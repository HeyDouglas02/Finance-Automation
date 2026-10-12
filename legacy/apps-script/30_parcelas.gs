/* ======================= HERANÇA ======================= */

function temEdicao_(r) {
  return r.revisado === true || !!r.divisao || (r.responsavel && r.responsavel !== 'Eu') || !!r.observacao;
}

function herdaDeRemovidos_(removidos, novos) {
  const usados = {};
  removidos.filter(temEdicao_).forEach(v => {
    const alvo = novos.find(n => !usados[n.id] && n.conta === v.conta &&
      Math.abs(n.valor - v.valor) < 0.01 &&
      Math.abs(new Date(n.data) - new Date(v.data)) <= 7 * 864e5);
    if (alvo) {
      usados[alvo.id] = true;
      EDITAVEIS.forEach(k => { alvo[k] = v[k]; });
    }
  });
}

/**
 * Agrupa as parcelas da mesma compra. O banco às vezes manda a data da compra com
 * 1 dia de diferença entre parcelas, então datas até 5 dias de distância contam como a mesma compra.
 */
function gruposParcela_(linhas) {
  const porBase = {};
  linhas.forEach(r => {
    if (!r.chave_parcela) return;
    const p = String(r.chave_parcela).split('|');
    if (p.length < 4) return;
    const base = [p[0], p[1], p[p.length - 1]].join('|');
    (porBase[base] = porBase[base] || []).push({ r: r, d: p[p.length - 2] });
  });
  const grupos = [];
  Object.keys(porBase).forEach(base => {
    const itens = porBase[base].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    let atual = null, inicio = null;
    itens.forEach(it => {
      if (!atual || Math.abs(new Date(it.d) - new Date(inicio)) > 5 * 864e5) {
        atual = [];
        inicio = it.d;
        grupos.push(atual);
      }
      atual.push(it.r);
    });
  });
  return grupos;
}

/** Parcela herda a classificação da última parcela revisada da mesma compra. */
function herdaParcelas_(linhas) {
  gruposParcela_(linhas).forEach(g => {
    const modelo = g.filter(r => r.revisado === true && !/^(Herdado|Histórico)/.test(r.observacao))
      .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    if (!modelo) return;
    g.forEach(r => {
      if (r === modelo || (r.revisado === true && !/^(Herdado|Histórico)/.test(r.observacao))) return;
      r.categoria = modelo.categoria;
      r.responsavel = modelo.responsavel;
      r.divisao = modelo.divisao;
      r.revisado = true;
      r.observacao = 'Herdado da parcela ' + modelo.parcela;
    });
  });
}

/**
 * O banco só manda cada parcela quando ela é lançada. Aqui criamos uma "previsão"
 * das parcelas que ainda faltam, a partir da última parcela conhecida de cada compra.
 * Quando a parcela real chega, a previsão daquele número deixa de ser criada.
 */
function projetaParcelas_(linhas) {
  gruposParcela_(linhas.filter(r => r.parcela)).forEach(g => {
    const num = r => Number(String(r.parcela).split('/')[0]);
    const total = Number(String(g[0].parcela).split('/')[1]);
    const ultima = g.reduce((a, b) => (num(b) > num(a) ? b : a));
    const existentes = {};
    g.forEach(r => { existentes[num(r)] = true; });
    for (let k = num(ultima) + 1; k <= total; k++) {
      if (existentes[k]) continue;
      const passo = k - num(ultima);
      linhas.push({
        data: somaMeses_(ultima.data, passo),
        conta: ultima.conta,
        descricao: ultima.descricao,
        valor: ultima.valor,
        categoria: ultima.categoria,
        responsavel: ultima.responsavel,
        divisao: ultima.divisao,
        revisado: true,
        observacao: 'Previsão (ainda não lançada pelo banco)',
        competencia: ymAdd_(ultima.competencia, passo),
        tipo: ultima.tipo,
        parcela: k + '/' + total,
        status: 'PREVISTO',
        cartao: ultima.cartao,
        compra_original: ultima.compra_original,
        chave_parcela: ultima.chave_parcela,
        billId: '',
        id: 'prev|' + ultima.chave_parcela + '|' + k,
      });
    }
  });
}

function somaMeses_(ymd, n) {
  const ym = ymAdd_(ymd.slice(0, 7), n);
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const ultimoDia = new Date(y, m, 0).getDate();
  const d = Math.min(Number(ymd.slice(8, 10)), ultimoDia);
  return ym + '-' + String(d).padStart(2, '0');
}
