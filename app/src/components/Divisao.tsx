import type { Opcao, Rateio } from '../lib/dados';
import { reais } from '../lib/formato';

/** Dono: minha (sem rateio), inteira de uma pessoa, ou dividida. */
export type Dono = { tipo: 'minha' } | { tipo: 'pessoa'; id: number } | { tipo: 'dividir' };
/** Linha da divisão: texto do campo + se é R$ ou %. */
type Parte = { texto: string; unidade: 'valor' | 'percentual' };
export type EstadoDivisao = { dono: Dono; partes: Record<number, Parte> };

export const DIVISAO_MINHA: EstadoDivisao = { dono: { tipo: 'minha' }, partes: {} };

// "12,5" ou "12.5" → 12.5; vazio ou inválido → 0
const numero = (texto: string) => Number(texto.replace(',', '.')) || 0;

/** Monta a tela a partir dos rateios gravados. Inteira de uma pessoa: 100% ou valor fixo igual ao total (como veio da importação). */
export function estadoDeRateios(rateios: Rateio[], total: number): EstadoDivisao {
  const r0 = rateios[0];
  const inteira = rateios.length === 1 && (r0.percentual === 100 || Math.abs((r0.valor ?? 0) - total) < 0.005);
  return {
    dono: !rateios.length ? { tipo: 'minha' } : inteira ? { tipo: 'pessoa', id: r0.pessoa_id } : { tipo: 'dividir' },
    partes: Object.fromEntries(rateios.map(r => [r.pessoa_id,
      r.percentual !== null ? { texto: String(r.percentual), unidade: 'percentual' } : { texto: String(r.valor), unidade: 'valor' }])),
  };
}

/** Rateios a gravar + sua parte. "incompleta" = escolheu Dividir mas não preencheu ninguém. */
export function calcularDivisao({ dono, partes }: EstadoDivisao, total: number) {
  const rateios: Rateio[] = dono.tipo === 'minha' ? []
    : dono.tipo === 'pessoa' ? [{ pessoa_id: dono.id, valor: null, percentual: 100 }]
    : Object.entries(partes).filter(([, p]) => numero(p.texto) > 0).map(([pid, p]) => ({
        pessoa_id: Number(pid),
        valor: p.unidade === 'valor' ? numero(p.texto) : null,
        percentual: p.unidade === 'percentual' ? numero(p.texto) : null,
      }));
  const minhaParte = total - rateios.reduce((t, r) => t + (r.valor ?? total * (r.percentual ?? 0) / 100), 0);
  return { rateios, minhaParte, passou: minhaParte < -0.005, incompleta: dono.tipo === 'dividir' && !rateios.length };
}

/** "De quem é?": Minha / cada pessoa / Dividir (valor ou % por pessoa), com a sua parte calculada. */
export function Divisao({ pessoas, estado, mudar, total }: {
  pessoas: Opcao[]; estado: EstadoDivisao; mudar: (e: EstadoDivisao) => void; total: number;
}) {
  const { dono, partes } = estado;
  const { minhaParte, passou } = calcularDivisao(estado, total);
  const setDono = (d: Dono) => mudar({ ...estado, dono: d });

  return <>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Chip ativo={dono.tipo === 'minha'} onClick={() => setDono({ tipo: 'minha' })}>Minha</Chip>
      {pessoas.map(p => (
        <Chip key={p.id} ativo={dono.tipo === 'pessoa' && dono.id === p.id} onClick={() => setDono({ tipo: 'pessoa', id: p.id })}>{p.nome}</Chip>
      ))}
      <Chip ativo={dono.tipo === 'dividir'} onClick={() => setDono({ tipo: 'dividir' })}>Dividir</Chip>
    </div>

    {dono.tipo === 'dividir' && (
      <section className="vidro" style={{ padding: '6px 16px' }}>
        {pessoas.map((p, i) => {
          const parte = partes[p.id] ?? { texto: '', unidade: 'valor' as const };
          const mudarParte = (m: Partial<Parte>) => mudar({ ...estado, partes: { ...partes, [p.id]: { ...parte, ...m } } });
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <label htmlFor={`parte-${p.id}`} style={{ flex: 1, fontSize: 15 }}>{p.nome}</label>
              <input id={`parte-${p.id}`} inputMode="decimal" placeholder="0" value={parte.texto} onChange={e => mudarParte({ texto: e.target.value })}
                className="pilula" style={{ width: 96, height: 40, padding: '0 12px', textAlign: 'right', fontSize: 15 }} />
              <button className="pilula" aria-label={`${p.nome}: trocar entre reais e porcentagem`}
                onClick={() => mudarParte({ unidade: parte.unidade === 'valor' ? 'percentual' : 'valor' })}
                style={{ width: 48, height: 40, fontSize: 14, fontWeight: 600 }}>
                {parte.unidade === 'valor' ? 'R$' : '%'}
              </button>
            </div>
          );
        })}
      </section>
    )}

    <div style={{ fontSize: 14, padding: '0 4px', color: passou ? 'var(--negativo)' : 'var(--texto-2)' }}>
      {passou ? `A divisão passa do valor em R$ ${reais(-minhaParte)}` : <>Sua parte: <b style={{ color: 'var(--texto)' }}>R$ {reais(minhaParte)}</b></>}
    </div>
  </>;
}

export function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} aria-pressed={ativo} className={ativo ? undefined : 'pilula'}
      style={{ height: 40, padding: '0 16px', borderRadius: 999, fontSize: 14,
        ...(ativo ? { border: '1.5px solid var(--mel)', background: 'rgba(242,184,75,0.14)', color: 'var(--mel)', fontWeight: 600 } : {}) }}>
      {children}
    </button>
  );
}

/** Título de seção dos formulários (De quem é?, Categoria…). */
export function Titulo({ children }: { children: string }) {
  return <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>{children}</div>;
}
