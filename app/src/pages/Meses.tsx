import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buscarMeses, type ResumoMes } from '../lib/dados';
import { mesAtual, nomeMes, reaisComSinal } from '../lib/formato';
import { Icone } from '../components/Icone';

/** Quantos meses futuros aparecem antes do "mostrar mais". */
const PROXIMOS_VISIVEIS = 3;

/** Tela satélite: mês atual no topo, depois os próximos (comprometido) e os anteriores (fechados). */
export function Meses() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const selecionado = params.get('mes') ?? mesAtual();
  const atual = mesAtual();
  const [meses, setMeses] = useState<ResumoMes[] | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { buscarMeses().then(setMeses).catch(e => { setErro(e.message); setMeses([]); }); }, []);

  // buscarMeses vem do mais novo pro mais antigo
  const doMesAtual = meses?.find(m => m.competencia === atual);
  const proximos = (meses ?? []).filter(m => m.competencia > atual && (m.saidas > 0 || m.renda > 0)).reverse();
  const anteriores = (meses ?? []).filter(m => m.competencia < atual);
  const proximosVisiveis = verTodos ? proximos : proximos.slice(0, PROXIMOS_VISIVEIS);

  // replace: escolher um mês volta pra tela Mês sem empilhar a tela Meses no histórico
  const abrir = (competencia: string) => navegar(`/?mes=${competencia}`, { replace: true });

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <button aria-label="Voltar" onClick={() => navegar(-1)}
          style={{ width: 36, height: 36, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)' }}>
          <Icone nome="seta" tamanho={22} />
        </button>
        <h1 className="titulo">Meses</h1>
      </header>

      {meses === null && <div className="mutado">Carregando…</div>}
      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erro}</div>}

      {meses && !erro && (
        <LinhaMes competencia={atual} subtitulo="Mês atual" destaque
          valor={doMesAtual ? <Saldo valor={doMesAtual.saldo} /> : <span className="mutado">Sem dados</span>}
          aoTocar={() => abrir(atual)} />
      )}

      {proximos.length > 0 && <>
        <Secao titulo="Próximos" />
        {proximosVisiveis.map(m => (
          <LinhaMes key={m.competencia} competencia={m.competencia} selecionado={m.competencia === selecionado}
            subtitulo={m.renda > 0 ? 'Previsto' : 'Já comprometido'}
            valor={m.renda > 0 ? <Saldo valor={m.saldo} />
              : <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mel)' }}>{reaisComSinal(m.saidas)}</span>}
            aoTocar={() => abrir(m.competencia)} />
        ))}
        {proximos.length > PROXIMOS_VISIVEIS && (
          <button onClick={() => setVerTodos(!verTodos)}
            style={{ alignSelf: 'flex-start', padding: '6px 4px', fontSize: 13, fontWeight: 600, color: 'var(--mel)' }}>
            {verTodos ? 'Mostrar menos' : `Mostrar mais ${proximos.length - PROXIMOS_VISIVEIS} meses`}
          </button>
        )}
      </>}

      {anteriores.length > 0 && <>
        <Secao titulo="Anteriores" />
        {anteriores.map(m => (
          <LinhaMes key={m.competencia} competencia={m.competencia} selecionado={m.competencia === selecionado}
            subtitulo="Fechado" valor={<Saldo valor={m.saldo} />} aoTocar={() => abrir(m.competencia)} />
        ))}
      </>}

      {proximos.length > 0 && (
        <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '4px 4px' }}>
          Já comprometido: parcelas, contas fixas e débitos que vão cair no mês, antes da renda ser lançada.
        </p>
      )}
    </main>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="mutado" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', margin: '10px 4px 0' }}>
      {titulo}
    </div>
  );
}

function Saldo({ valor }: { valor: number }) {
  return (
    <span style={{ fontSize: 16, fontWeight: 700, color: valor < 0 ? 'var(--negativo)' : 'var(--positivo)' }}>
      {valor > 0 ? '+' : ''}{reaisComSinal(valor)}
    </span>
  );
}

function LinhaMes({ competencia, subtitulo, valor, aoTocar, destaque = false, selecionado = false }: {
  competencia: string; subtitulo: string; valor: ReactNode; aoTocar: () => void; destaque?: boolean; selecionado?: boolean;
}) {
  const estilo = destaque
    ? { background: 'linear-gradient(135deg, rgba(242,184,75,0.22), rgba(242,184,75,0.06) 70%)', borderColor: 'rgba(242,184,75,0.45)' }
    : selecionado ? { borderColor: 'rgba(242,184,75,0.45)' } : {};
  return (
    <button className="vidro" onClick={aoTocar}
      style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', ...estilo }}>
      <span>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{nomeMes(competencia)}</span>
        <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{subtitulo}</span>
      </span>
      {valor}
    </button>
  );
}
