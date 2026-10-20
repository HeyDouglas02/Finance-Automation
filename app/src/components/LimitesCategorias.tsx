import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { buscarConfigOrcamento, definirLimite, definirOrcamento } from '../lib/dados';
import { nomeMes, reais } from '../lib/formato';

// "1.385,50", "1385,5" ou "1385.5" → 1385.5; vazio → null
const lerValor = (texto: string) => {
  const t = texto.trim();
  if (!t) return null;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
};
// valor gravado → texto do campo: 250 → "250,00"
const texto = (valor: number | null) => (valor === null ? '' : valor.toFixed(2).replace('.', ','));

type CampoOrc = 'rendaBase' | 'reserva' | 'meta' | 'teto';
const CAMPOS_ORC: { chave: CampoOrc; nome: string; dica: string }[] = [
  { chave: 'rendaBase', nome: 'Renda base', dica: 'base pra montar os valores' },
  { chave: 'reserva', nome: 'Reserva', dica: 'Saúde e Imprevistos juntos' },
  { chave: 'meta', nome: 'Meta', dica: 'quanto quer que sobre no mês' },
  { chave: 'teto', nome: 'Teto de parcelas', dica: 'vazio = sem teto' },
];

/** Regras 13 a 17: limite em reais de cada grupo, mais renda base, reserva, meta e teto de parcelas. */
export function LimitesCategorias() {
  const consulta = useQuery({ queryKey: ['configOrcamento'], queryFn: buscarConfigOrcamento });
  const [limites, setLimites] = useState<Record<number, string>>({});   // só os editados
  const [orc, setOrc] = useState<Partial<Record<CampoOrc, string>>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const c = consulta.data;
  if (!c) return consulta.error ? <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {consulta.error.message}</div> : null;

  const limiteDe = (id: number, gravado: number | null) => (id in limites ? lerValor(limites[id]) : gravado);
  const orcDe = (chave: CampoOrc) => (chave in orc ? lerValor(orc[chave]!) : c[chave]);
  const somaLimites = c.grupos.reduce((t, g) => t + (limiteDe(g.id, g.limite) ?? 0), 0);
  const rendaBase = orcDe('rendaBase') ?? 0;
  const sobra = rendaBase - c.fixos - (orcDe('reserva') ?? 0) - (orcDe('meta') ?? 0) - somaLimites;

  const valores = [...Object.values(limites), ...Object.values(orc)].map(t => lerValor(t ?? ''));
  const invalido = valores.some(v => v !== null && (Number.isNaN(v) || v < 0))
    || ('rendaBase' in orc && !(rendaBase > 0));
  const mudou = Object.keys(limites).length > 0 || Object.keys(orc).length > 0;
  const mes = nomeMes(c.aPartir).split(' ')[0].toLowerCase();

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await Promise.all([
        ...Object.entries(limites).map(([id, t]) => definirLimite(Number(id), lerValor(t) || null, c.aPartir)),
        ...(Object.keys(orc).length
          ? [definirOrcamento(c.aPartir, rendaBase, orcDe('reserva') ?? 0, orcDe('meta') ?? 0, orcDe('teto') || null)]
          : []),
      ]);
      setLimites({});
      setOrc({});
      setAviso(`Salvo. Vale a partir de ${mes}.`);
      dadosMudaram();
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  const linha = (id: string, nome: string, dica: string, valor: string, mudar: (t: string) => void, placeholder: string, primeira: boolean) => (
    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <label htmlFor={id} style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{nome}</span>
        <span className="mutado" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{dica}</span>
      </label>
      <span className="mutado" style={{ fontSize: 14 }}>R$</span>
      <input id={id} inputMode="decimal" placeholder={placeholder} value={valor} onChange={e => { mudar(e.target.value); setAviso(''); }}
        className="pilula" style={{ width: 96, height: 38, padding: '0 10px', textAlign: 'right', fontSize: 15 }} />
    </div>
  );

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 4px 0' }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>Limites do mês</span>
      <span className="mutado" style={{ fontSize: 12 }}>valem a partir de {mes}</span>
    </div>

    <section className="vidro" style={{ padding: '4px 16px' }}>
      {c.grupos.map((g, i) => linha(`lim-${g.id}`, g.nome, g.limite === null ? 'sem limite' : 'limite do mês',
        limites[g.id] ?? texto(g.limite), t => setLimites({ ...limites, [g.id]: t }), 'sem limite', i === 0))}
    </section>

    <section className="vidro" style={{ padding: '4px 16px' }}>
      {CAMPOS_ORC.map((f, i) => linha(`orc-${f.chave}`, f.nome, f.dica,
        orc[f.chave] ?? texto(c[f.chave]), t => setOrc({ ...orc, [f.chave]: t }), f.chave === 'teto' ? 'sem teto' : '0,00', i === 0))}
    </section>

    {/* a conta da regra 13: renda base − fixas − reserva − meta − limites */}
    <div style={{ fontSize: 13, lineHeight: 1.6, margin: '0 4px' }}>
      <div className="mutado">Renda base R$ {reais(rendaBase)} − contas fixas R$ {reais(c.fixos)} − reserva − meta − limites</div>
      {sobra >= -0.005
        ? <div style={{ color: 'var(--positivo)', fontWeight: 600 }}>O orçamento fecha: sobra R$ {reais(sobra)}</div>
        : <div role="alert" style={{ color: 'var(--negativo)', fontWeight: 600 }}>O orçamento não fecha: faltam R$ {reais(-sobra)}</div>}
    </div>

    {invalido && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>Use valores positivos (e uma renda base maior que zero).</div>}
    {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
    {aviso && !mudou && <div role="status" style={{ color: 'var(--positivo)', fontSize: 13 }}>{aviso}</div>}
    {mudou && (
      <button className="botao-mel" disabled={salvando || invalido} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar limites'}
      </button>
    )}
  </>;
}
