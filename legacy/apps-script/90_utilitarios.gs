/* ======================= UTILITÁRIOS ======================= */

const ORDEM_ABAS = ['Transacoes', 'Acertos', 'Faturas', 'Lancamentos'];

function aba_(nome) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    const pos = ORDEM_ABAS.indexOf(nome);
    sh = pos >= 0 ? ss.insertSheet(nome, Math.min(pos, ss.getSheets().length)) : ss.insertSheet(nome);
  }
  return sh;
}

function linhas_(sh) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function toast_(msg) {
  try { SpreadsheetApp.getActive().toast(msg, 'Finanças', 8); } catch (e) { console.log(msg); }
}

function norm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function r2_(n) { return Math.round(n * 100) / 100; }

function num_(s) {
  if (typeof s === 'number') return s;
  s = String(s).trim();
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

function brl_(v) {
  const n = r2_(Math.abs(v)).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + 'R$ ' + n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + n[1];
}

/** ISO da API, Date da planilha ou texto → 'yyyy-MM-dd' no fuso de São Paulo. */
function ymd_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];
  if (/T00:00:00(\.000)?Z$/.test(s)) return s.slice(0, 10); // data "pura", sem horário
  return Utilities.formatDate(new Date(s), TZ, 'yyyy-MM-dd');
}

/** Data gravada como texto dd/MM/yyyy (evita problemas de fuso e datas inválidas). */
function dateCell_(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  return ymd.slice(8, 10) + '/' + ymd.slice(5, 7) + '/' + ymd.slice(0, 4);
}

function ymAdd_(ym, n) {
  let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return y + '-' + String(m).padStart(2, '0');
}

function hojeMenos_(dias) {
  return Utilities.formatDate(new Date(Date.now() - dias * 864e5), TZ, 'yyyy-MM-dd');
}
