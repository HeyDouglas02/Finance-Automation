import { useQuery } from '@tanstack/react-query';
import { buscarConexoes, type Conexao } from '../lib/dados';
import { quandoLegivel } from '../lib/formato';

// o Meu Pluggy vai ao banco 1×/dia: passou de 36h sem atualizar, algo travou
const HORAS_ATRASO = 36;

/** Bancos conectados: quando o Meu Pluggy buscou no banco e quando o app leu. */
export function Conexoes() {
  const consulta = useQuery({ queryKey: ['conexoes'], queryFn: buscarConexoes });
  const conexoes = consulta.data ?? [];

  return <>
    <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>Bancos</div>
    {consulta.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {consulta.error.message}</div>}
    <section className="vidro" style={{ padding: '4px 16px' }}>
      {conexoes.map((c, i) => <LinhaConexao key={c.contas} conexao={c} primeira={i === 0} />)}
      {consulta.data && !conexoes.length && <div className="mutado" style={{ padding: '12px 0', fontSize: 14 }}>Nenhum banco conectado.</div>}
    </section>
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      O Meu Pluggy busca no banco 1 vez por dia, no horário dele. O app lê do Meu Pluggy a cada 3 horas.
    </p>
  </>;
}

function LinhaConexao({ conexao: c, primeira }: { conexao: Conexao; primeira: boolean }) {
  const comErro = c.status !== 'UPDATED' || (c.execucao !== null && c.execucao !== 'SUCCESS');
  const horas = c.ultimaAtualizacao ? (Date.now() - new Date(c.ultimaAtualizacao).getTime()) / 3_600_000 : Infinity;
  const atrasado = !comErro && horas > HORAS_ATRASO;
  const cor = comErro ? 'var(--negativo)' : atrasado ? 'var(--mel)' : 'var(--positivo)';
  const situacao = comErro ? `Erro: ${c.status}${c.execucao ? ` / ${c.execucao}` : ''}` : atrasado ? `Sem atualizar há ${Math.floor(horas)}h` : 'Conectado';

  return (
    <div style={{ padding: '12px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: cor, boxShadow: `0 0 6px ${cor}`, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{c.contas}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: cor }}>{situacao}</span>
      </div>
      <div className="mutado" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6, paddingLeft: 16 }}>
        <div>Banco atualizado: {c.ultimaAtualizacao ? quandoLegivel(c.ultimaAtualizacao) : '—'}</div>
        <div>Lido pelo app: {c.sincronizadoEm ? quandoLegivel(c.sincronizadoEm) : '—'}</div>
        {c.avisos && <div style={{ color: 'var(--mel)' }}>{c.avisos}</div>}
      </div>
    </div>
  );
}
