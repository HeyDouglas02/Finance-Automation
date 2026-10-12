/**
 * Finanças — Pluggy (Open Finance) → Google Sheets
 *
 * Propriedades do script: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, ITEM_IDS
 * Abas geradas:  Transacoes, Faturas, Acertos
 * Abas de configuração (criadas na 1ª execução, editáveis):
 *   cfg_geral, cfg_categorias, cfg_pessoas, cfg_cartoes
 *
 * Não mexe nas abas de meses antigas.
 */

const API = 'https://api.pluggy.ai';
// true = puxa só os cartões de crédito (os listados em cfg_cartoes). Contas bancárias e Pix ficam de fora.
const SO_CREDITO = true;
const TZ = 'America/Sao_Paulo';

const KEYS = ['data', 'conta', 'descricao', 'valor', 'categoria', 'responsavel', 'divisao', 'revisado',
  'observacao', 'competencia', 'tipo', 'parcela', 'status', 'cartao', 'compra_original',
  'chave_parcela', 'billId', 'id', 'minha_parte'];
const HEAD = ['Data', 'Conta', 'Descrição', 'Valor', 'Categoria', 'Responsável', 'Divisão', 'Revisado',
  'Observação', 'Competência', 'Tipo', 'Parcela', 'Status', 'Cartão', 'Compra original',
  'Chave parcela', 'Fatura', 'ID', 'Minha parte'];
const K = {};
KEYS.forEach((k, i) => { K[k] = i; });
const EDITAVEIS = ['categoria', 'responsavel', 'divisao', 'revisado', 'observacao'];
const TEXTO = ['data', 'competencia', 'parcela', 'compra_original', 'chave_parcela', 'billId', 'id', 'divisao', 'cartao'];

const CATEGORIAS_BASE = ['Mercado', 'Necessidades', 'Eletrônicos', 'Assinaturas', 'Roupa', 'Beleza',
  'Presentes', 'Saúde', 'Despesas eventuais', 'Desenvolvimento', 'Uber/transporte', 'IFood/restaurante',
  'Lazer', 'Aluguel', 'Contas', 'Taxas', 'Faculdade', 'Conta fixa', 'Gasolina', 'A revisar', 'Acerto', 'Entrada a classificar', 'Renda'];


/* ======================= CONFIGURAÇÃO ======================= */

function lerCfg_() {
  const geral = {}, categorias = [], pessoas = [], cartoes = {};

  linhas_(abaCfg_('cfg_geral', ['Chave', 'Valor'], [
    ['MEU_NOME', 'SEU NOME COMPLETO'],
    ['PRIMEIRA_CARGA_DESDE', '2026-08-01'],
    ['ACERTOS_DESDE', '2026-10'],
    ['PAGAMENTOS_DESDE', '2026-10-09'],
    ['COBRANCA_COMPETENCIA', ''],
  ])).forEach(l => { if (l[0]) geral[String(l[0]).trim()] = String(l[1]).trim(); });

  linhas_(abaCfg_('cfg_categorias', ['Contém (no nome)', 'Categoria', 'Divisão padrão (opcional)'], [
    ['99FOOD', 'IFood/restaurante', ''], ['IFOOD', 'IFood/restaurante', ''],
    ['BURGER KING', 'IFood/restaurante', ''], ['ZONTA', 'IFood/restaurante', ''],
    ['SHAWARMA', 'IFood/restaurante', ''], ['ACAI', 'IFood/restaurante', ''],
    ['BOTECO', 'IFood/restaurante', ''], ['PIZZ', 'IFood/restaurante', ''],
    ['BELLAVI', 'IFood/restaurante', ''], ['KALZONE', 'IFood/restaurante', ''],
    ['COFFEE', 'IFood/restaurante', ''], ['CAFE', 'IFood/restaurante', ''],
    ['PANIFICADORA', 'IFood/restaurante', ''], ['CREPES', 'IFood/restaurante', ''],
    ['CHACARA', 'IFood/restaurante', ''], ['FOOD', 'IFood/restaurante', ''],
    ['SUPERDIA', 'Mercado', ''], ['CONDOR', 'Mercado', ''], ['ADORATTO', 'Mercado', ''],
    ['SUPER G', 'Mercado', ''], ['PLANTA CA', 'Mercado', ''], ['GJK', 'Mercado', ''],
    ['CHOCOMIX', 'Mercado', ''], ['DEGAS', 'Mercado', ''], ['DISTRITO DA CARNE', 'Mercado', ''],
    ['CACAU SHOW', 'Mercado', ''], ['XV DE NOVEMBRO', 'Mercado', ''], ['SUPERMERCADO', 'Mercado', ''],
    ['UBER', 'Uber/transporte', ''], ['99*', 'Uber/transporte', ''],
    ['TRANSP COLETIVO', 'Uber/transporte', ''], ['M*BUS', 'Uber/transporte', ''],
    ['BETPR', 'Uber/transporte', ''],
    ['CENTAURO', 'Roupa', ''], ['NIKE', 'Roupa', ''], ['DOGTOWN', 'Roupa', ''],
    ['STUDIO Z', 'Roupa', ''], ['SHEIN', 'Roupa', ''], ['BALISHOES', 'Roupa', ''],
    ['BERZERK', 'Roupa', ''], ['PARADA 12', 'Roupa', ''], ['FASHIONNINA', 'Roupa', ''],
    ['LAS CONDES', 'Roupa', ''], ['RENNER', 'Roupa', ''], ['REALIZE', 'Roupa', ''],
    ['MIDWAY', 'Roupa', ''],
    ['APPLE.COM', 'Assinaturas', ''],
    ['HYPEGYM', 'Saúde', ''], ['PARANAENSE', 'Saúde', ''], ['RUHAN', 'Saúde', ''],
    ['FARMACIA', 'Necessidades', ''], ['MEDICAMEN', 'Necessidades', ''], ['PAYPHARMA', 'Necessidades', ''],
    ['INGRESSO', 'Lazer', ''], ['BOLICHE', 'Lazer', ''], ['STEAM', 'Lazer', ''],
    ['LIV CTBA', 'Desenvolvimento', ''],
    ['MECANICA', 'Despesas eventuais', ''], ['AUTOPECAS', 'Despesas eventuais', ''],
    ['ACESSORIO', 'Despesas eventuais', ''], ['TOTALCOMERCIO', 'Despesas eventuais', ''],
    ['BRCELL', 'Eletrônicos', ''], ['LIDERCELL', 'Eletrônicos', ''],
    ['ERD PRESENTES', 'Presentes', ''],
    ['DIRECT INTERNET', 'Contas', ''],
    ['COMPLEXO', 'Faculdade', 'Pessoa A 50%'],
  ])).forEach(l => { if (l[0] && l[1]) categorias.push([String(l[0]), String(l[1]), String(l[2] || '')]); });

  linhas_(abaCfg_('cfg_pessoas', ['Contém (no Pix)', 'Pessoa', 'Saldo inicial'], [
    ['NOME NO PIX', 'Pessoa A', '-875'],
    ['NOME NO PIX', 'Pessoa B', '-199,65'],
    ['NOME NO PIX', 'Pessoa C', '0'],
  ])).forEach(l => { if (l[0] && l[1]) pessoas.push([String(l[0]), String(l[1]), String(l[2] || '')]); });

  linhas_(abaCfg_('cfg_cartoes', ['Conta (nome da API)', 'Dia de fechamento'], [
    ['VISA PLATINUM', '22'], ['ELO GRAFITE', '25'], ['GOLD', '30'],
  ])).forEach(l => { if (l[0]) cartoes[String(l[0])] = Number(l[1]); });

  return { geral: geral, categorias: categorias, pessoas: pessoas, cartoes: cartoes };
}

function abaCfg_(nome, cab, padrao) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (padrao.length) {
      sh.getRange(2, 1, padrao.length, cab.length).setNumberFormat('@').setValues(padrao);
    }
    sh.hideSheet();
  }
  return sh;
}
