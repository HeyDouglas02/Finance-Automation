/* ======================= MENU E GATILHO ======================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Finanças')
    .addItem('Sincronizar agora', 'sincronizar')
    .addItem('Recalcular (depois de editar)', 'recalcular')
    .addSeparator()
    .addItem('Mostrar/ocultar configurações', 'alternarConfig')
    .addItem('Ativar sincronização diária', 'instalarGatilhoDiario')
    .addToUi();
}

function alternarConfig() {
  const abas = SpreadsheetApp.getActive().getSheets().filter(s => /^cfg_/.test(s.getName()));
  const mostrar = abas.some(s => s.isSheetHidden());
  abas.forEach(s => (mostrar ? s.showSheet() : s.hideSheet()));
}

function instalarGatilhoDiario() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sincronizar')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sincronizar').timeBased().everyDays(1).atHour(6).create();
  toast_('Sincronização diária ativada (por volta das 6h).');
}

/* ======================= SINCRONIZAÇÃO ======================= */

function sincronizar() {
  sincroniza_(null);
}

/** Rode uma vez se as datas aparecerem vazias ou como 1969: rebusca tudo desde a 1ª carga. */
function repararDatas() {
  sincroniza_(lerCfg_().geral.PRIMEIRA_CARGA_DESDE || '2026-08-01');
}

function sincroniza_(desdeForcado) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const cfg = lerCfg_();
    const props = PropertiesService.getScriptProperties();
    const key = apiKey_();
    const itemIds = (props.getProperty('ITEM_IDS') || '').split(',').map(s => s.trim()).filter(String);
    if (!itemIds.length) throw new Error('Preencha ITEM_IDS nas propriedades do script.');

    const atuais = lerTransacoes_();
    const porId = {};
    atuais.forEach(r => { porId[r.id] = r; });
    const desde = desdeForcado ||
      (atuais.length ? hojeMenos_(45) : (cfg.geral.PRIMEIRA_CARGA_DESDE || hojeMenos_(60)));
    const faturas = lerFaturas_();
    const vistos = {}, contasSync = {}, novos = [];
    const conexoes = [];

    itemIds.forEach(itemId => {
      const st = statusItem_(itemId, key);
      conexoes.push(st);
      (get_('/accounts?itemId=' + itemId, key).results || []).forEach(acc => {
        if (SO_CREDITO && acc.type !== 'CREDIT') return;
        const conta = nomeConta_(acc);
        st.contas.push(conta);
        contasSync[conta] = true;
        const txs = buscaTransacoes_(acc.id, desde, key);
        if (acc.type === 'CREDIT') atualizaFaturas_(acc, conta, faturas, key);
        txs.forEach(t => {
          vistos[t.id] = true;
          const nova = montaLinha_(t, acc, cfg, faturas);
          const velha = porId[t.id];
          if (velha) {
            const manter = {};
            EDITAVEIS.forEach(k => { manter[k] = velha[k]; });
            // se ainda não revisou e a categoria estava pendente, tenta as regras de novo
            if (!velha.revisado && (!velha.categoria || velha.categoria === 'A revisar') &&
                nova.categoria !== 'A revisar') {
              manter.categoria = nova.categoria;
            }
            Object.assign(velha, nova, manter);
          } else {
            porId[t.id] = nova;
            novos.push(nova);
          }
        });
      });
    });

    // compras pendentes que sumiram da API (viraram lançamento definitivo com outro ID)
    const removidos = [];
    Object.keys(porId).forEach(id => {
      const r = porId[id];
      if (!vistos[id] && contasSync[r.conta] && r.data >= desde && String(r.status) === 'PENDING') {
        removidos.push(r);
        delete porId[id];
      }
    });
    herdaDeRemovidos_(removidos, novos);

    const linhas = Object.keys(porId).map(id => porId[id]);
    finaliza_(linhas, faturas, cfg);
    salvaConexoes_(conexoes, '');
    toast_(novos.length + ' novas transações · ' + contaPendentes_(linhas) + ' a revisar');
  } catch (e) {
    salvaConexoes_([], String(e).slice(0, 300));
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Use depois de editar categorias/responsáveis/divisões: não chama a API. */
function recalcular() {
  const cfg = lerCfg_();
  const linhas = lerTransacoes_();
  finaliza_(linhas, lerFaturas_(), cfg);
  toast_('Recalculado · ' + contaPendentes_(linhas) + ' a revisar');
}

function finaliza_(linhas, faturas, cfg) {
  if (SO_CREDITO) {
    const cartoes = cfg.cartoes;
    for (let i = linhas.length - 1; i >= 0; i--) {
      if (!(linhas[i].conta in cartoes)) linhas.splice(i, 1);
    }
  }
  // remove as previsões da rodada anterior (são recriadas abaixo)
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (String(linhas[i].id).indexOf('prev|') === 0) linhas.splice(i, 1);
  }
  marcaHistorico_(linhas, cfg);
  herdaParcelas_(linhas);
  projetaParcelas_(linhas);
  // a sua parte de cada gasto (usada pela aba Resumo)
  linhas.forEach(r => {
    r.minha_parte = r.tipo === 'Gasto' ? r2_(partes_(r, cfg).Eu || 0) : 0;
  });
  salvaTransacoes_(linhas, cfg);
  salvaFaturas_(faturas, linhas, cfg);
  geraLancamentos_(linhas, cfg);
}

/** O que é anterior ao início dos acertos não precisa de revisão. */
function marcaHistorico_(linhas, cfg) {
  const desde = cfg.geral.ACERTOS_DESDE || '0000-00';
  linhas.forEach(r => {
    if (r.revisado !== true && r.tipo !== 'Ignorado' && r.competencia < desde) {
      r.revisado = true;
      if (!r.observacao) r.observacao = 'Histórico (antes do sistema)';
    }
  });
}

function contaPendentes_(linhas) {
  return linhas.filter(r => r.tipo !== 'Ignorado' && r.revisado !== true).length;
}

/* ======================= STATUS DAS CONEXÕES ======================= */

function salvaConexoes_(conexoes, erroGeral) {
  const agora = Utilities.formatDate(new Date(), TZ, 'dd/MM HH:mm');
  const linhas = [['Contas', 'Status', 'Execução', 'Última atualização do banco', 'Avisos', 'Resumo']];
  if (erroGeral) {
    linhas.push(['', 'ERRO', '', '', erroGeral, '⚠ A sincronização de ' + agora + ' falhou: ' + erroGeral]);
  }
  conexoes.forEach(c => {
    const ultima = c.ultima ? Utilities.formatDate(new Date(c.ultima), TZ, 'dd/MM HH:mm') : '?';
    const horas = c.ultima ? (Date.now() - new Date(c.ultima).getTime()) / 36e5 : 999;
    const contas = c.contas.join(', ') || c.itemId;
    let icone = '✅', dica = '';
    if (['LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_INPUT', 'ERRO'].indexOf(c.status) >= 0 || c.execucao === 'ERROR') {
      icone = '⚠'; dica = ' · reconecte no meu.pluggy.ai';
    } else if (c.execucao === 'PARTIAL_SUCCESS' || c.avisos.length || horas > 48) {
      icone = '🟡'; dica = horas > 48 ? ' · sem atualizar há ' + Math.round(horas / 24) + ' dias' : ' · atualização parcial';
    }
    linhas.push([contas, c.status, c.execucao, ultima, c.avisos.join(' | '),
      icone + ' ' + contas + ': banco atualizado em ' + ultima + dica]);
  });
  linhas.push(['', '', '', '', '', 'Planilha sincronizada em ' + agora]);
  const sh = aba_('Conexoes');
  sh.clearContents();
  sh.getRange(1, 1, linhas.length, 6).setNumberFormat('@').setValues(linhas);
  if (!sh.isSheetHidden()) sh.hideSheet();
}
