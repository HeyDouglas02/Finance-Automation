import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { buscarLimites, buscarResumo, salvarLimite } from '../lib/dados';
import { mesAtual, nomeMes, reais } from '../lib/formato';

// "12,5" ou "12.5" → 12.5; vazio → null (sem limite)
const lerPct = (texto: string) => (texto.trim() ? Number(texto.replace(',', '.')) : null);

/** Regra 12: limite de cada categoria em % da renda. Mostra o equivalente em reais com a renda deste mês. */
export function LimitesCategorias() {
  const limites = useQuery({ queryKey: ['limites'], queryFn: buscarLimites });
  const atual = mesAtual();
  const renda = useQuery({ queryKey: ['resumo', atual], queryFn: () => buscarResumo(atual) }).data?.renda ?? 0;
  const [editados, setEditados] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const lista = limites.data ?? [];
  const textoDe = (id: number, limite: number | null) => editados[id] ?? (limite === null ? '' : String(limite).replace('.', ','));
  const pctDe = (id: number, limite: number | null) => (id in editados ? lerPct(editados[id]) : limite);
  const soma = lista.reduce((t, c) => t + (pctDe(c.id, c.limite) ?? 0), 0);
  const invalidos = Object.values(editados).some(t => { const v = lerPct(t); return v !== null && (!(v > 0) || v > 100); });
  const mudou = Object.keys(editados).length > 0;

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await Promise.all(Object.entries(editados).map(([id, t]) => salvarLimite(Number(id), lerPct(t))));
      setEditados({});
      setAviso('Limites salvos.');
      dadosMudaram();
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 4px 0' }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>Limites por categoria</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: soma > 100 ? 'var(--negativo)' : 'var(--texto-2)' }}>soma {Math.round(soma)}% da renda</span>
    </div>
    {limites.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {limites.error.message}</div>}

    <section className="vidro" style={{ padding: '4px 16px' }}>
      {lista.map((c, i) => {
        const pct = pctDe(c.id, c.limite);
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <label htmlFor={`lim-${c.id}`} style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{c.nome}</span>
              <span className="mutado" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                {pct && renda > 0 ? `= R$ ${reais(renda * pct / 100)} em ${nomeMes(atual).split(' ')[0].toLowerCase()}` : 'sem limite'}
              </span>
            </label>
            <input id={`lim-${c.id}`} inputMode="decimal" placeholder="—" value={textoDe(c.id, c.limite)}
              onChange={e => { setEditados({ ...editados, [c.id]: e.target.value }); setAviso(''); }}
              className="pilula" style={{ width: 70, height: 38, padding: '0 10px', textAlign: 'right', fontSize: 15 }} />
            <span className="mutado" style={{ fontSize: 14, width: 14 }}>%</span>
          </div>
        );
      })}
    </section>

    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      Em % da renda do mês: se o salário muda, o limite em reais muda junto. Deixe vazio pra não ter limite.
      {soma > 100 && <span style={{ color: 'var(--negativo)' }}> A soma passa de 100%: o orçamento não fecha.</span>}
    </p>
    {invalidos && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>Use um número entre 0 e 100.</div>}
    {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
    {aviso && !mudou && <div role="status" style={{ color: 'var(--positivo)', fontSize: 13 }}>{aviso}</div>}
    {mudou && (
      <button className="botao-mel" disabled={salvando || invalidos} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar limites'}
      </button>
    )}
  </>;
}
