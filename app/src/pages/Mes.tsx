import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { diaMesCurto, mesAtual, nomeMes, reais, reaisComSinal, somaMes } from '../lib/formato';
import {
  buscarAReceber, buscarCategorias, buscarFaturaProxima, buscarResumo,
  type AReceber, type Categoria, type FaturaProxima, type ResumoMes,
} from '../lib/dados';
import { Icone } from '../components/Icone';
import { Anel } from '../components/Anel';

/** Cor e ícone de cada categoria no cartão "Categorias". */
const ESTILO_CATEGORIA: Record<string, { cor: string; icone: string }> = {
  'Conta fixa': { cor: '#F2B84B', icone: 'M3 11l9-7 9 7 M5 10v9h14v-9' },
  'Mercado': { cor: '#F2B84B', icone: 'M4 7h16l-1.5 12h-13z M8 7l4 5 4-5' },
  'Gasolina': { cor: '#F0533F', icone: 'M5 20V6a2 2 0 012-2h6a2 2 0 012 2v14 M4 20h12' },
  'Roupa': { cor: '#F2B84B', icone: 'M16 4l-4 2-4-2-4 3 2 3v10h12V10l2-3z' },
};
const PADRAO = { cor: '#F2B84B', icone: 'M4 5h16v14H4z M8 10h8 M8 14h4' };

export function Mes() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const competencia = params.get('mes') ?? mesAtual();

  const [resumo, setResumo] = useState<ResumoMes | null | undefined>(undefined);
  const [fatura, setFatura] = useState<FaturaProxima>(null);
  const [receber, setReceber] = useState<AReceber>({ total: 0, pessoas: 0 });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let valido = true;   // trocou de mês antes da resposta chegar: descarta a antiga
    setResumo(undefined);
    setErro('');
    Promise.all([
      buscarResumo(competencia),
      buscarFaturaProxima(),
      buscarAReceber(competencia),
      buscarCategorias(competencia),
    ]).then(([r, f, a, c]) => { if (valido) { setResumo(r); setFatura(f); setReceber(a); setCategorias(c); } })
      .catch(e => { if (valido) { setErro(e.message); setResumo(null); } });
    return () => { valido = false; };
  }, [competencia]);

  const saldo = resumo?.saldo ?? 0;
  const fracao = resumo && resumo.renda > 0 ? resumo.saidas / resumo.renda : 0;
  const estourou = fracao > 1;

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 23, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 17, color: '#F2E4CF', background: 'radial-gradient(circle at 35% 30%, #6B5A48, #2A231C)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.14)' }}>D</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Olá, Douglas</div>
            <div className="mutado" style={{ fontSize: 13 }}>
              {resumo ? (saldo < 0 ? 'Mês no vermelho, olho nos gastos' : 'Tudo certo por aqui!') : ' '}
            </div>
          </div>
        </div>
        {/* temporário: o sino faz logout até existirem notificações */}
        <button aria-label="Sair" title="Sair" onClick={() => supabase.auth.signOut()}
          style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome="sino" tamanho={22} cor="#E8E2D8" />
        </button>
      </header>

      {/* setas em volta do mês: um mês por vez, sem empilhar histórico */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="pilula" aria-label="Mês anterior" onClick={() => navegar(`/?mes=${somaMes(competencia, -1)}`, { replace: true })}
          style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)' }}>
          <Icone nome="seta" tamanho={18} cor="#E8E2D8" />
        </button>
        <button className="pilula" onClick={() => navegar(`/meses?mes=${competencia}`)}
          style={{ flex: 1, height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, fontWeight: 500 }}>
          <Icone nome="calendario" tamanho={18} cor="#E8E2D8" />
          {nomeMes(competencia)}
          <Icone nome="baixo" tamanho={16} cor="#E8E2D8" />
        </button>
        <button className="pilula" aria-label="Próximo mês" onClick={() => navegar(`/?mes=${somaMes(competencia, 1)}`, { replace: true })}
          style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome="seta" tamanho={18} cor="#E8E2D8" />
        </button>
      </div>

      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erro}</div>}

      <section className="vidro" style={{ padding: '18px 18px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Saldo do mês</div>
        {resumo === undefined ? <div className="mutado" style={{ marginTop: 8 }}>Carregando…</div>
          : resumo === null ? <div className="mutado" style={{ marginTop: 8 }}>Sem dados para este mês.</div>
          : <>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.8, marginTop: 6,
              color: saldo < 0 ? 'var(--negativo)' : 'var(--texto)',
              textShadow: saldo < 0 ? '0 0 22px rgba(240,83,63,0.35)' : 'none' }}>{reaisComSinal(saldo)}</div>
            <div style={{ display: 'flex', gap: 26, marginTop: 10, fontSize: 14 }}>
              <span className="mutado">Entra <b style={{ color: 'var(--mel)', fontWeight: 600 }}>R$ {reais(resumo.renda)}</b></span>
              <span className="mutado">Sai <b style={{ color: 'var(--negativo)', fontWeight: 600 }}>R$ {reais(resumo.saidas)}</b></span>
            </div>
          </>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <CartaoPequeno titulo="Fatura atual" valor={fatura ? `R$ ${reais(fatura.total)}` : '—'}
          rodape={fatura ? `Vence ${diaMesCurto(fatura.vencimento)}` : 'Nenhuma a vencer'} />
        <CartaoPequeno titulo="A receber" valor={`R$ ${reais(receber.total)}`}
          rodape={receber.pessoas ? `${receber.pessoas} ${receber.pessoas === 1 ? 'pessoa' : 'pessoas'}` : 'Tudo recebido'}
          aoTocar={() => navegar('/acertos')} />
      </div>

      <section className="vidro" style={{ padding: '14px 16px 16px' }}>
        <div className="mutado" style={{ fontSize: 14 }}>Ritmo do mês (sua parte)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 10 }}>
          <Anel fracao={fracao} alerta={estourou} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>R$ {reais(resumo?.saidas ?? 0)}</div>
            <div className="mutado" style={{ fontSize: 14, marginTop: 2 }}>
              {resumo?.renda
                ? <><b style={{ fontWeight: 600, color: estourou ? 'var(--negativo)' : 'inherit' }}>{Math.round(fracao * 100)}%</b> da renda de R$ {reais(resumo.renda)}</>
                : 'Renda ainda não lançada'}
            </div>
          </div>
        </div>
      </section>

      <section className="vidro" style={{ padding: '14px 14px 14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Categorias · sua parte</span>
          <span style={{ fontSize: 12, color: 'var(--mel)', fontWeight: 600 }}>ver todas →</span>
        </div>
        <div style={{ width: 12, height: 2, borderRadius: 1, background: 'var(--mel)', marginTop: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
          {categorias.slice(0, 4).map(c => {
            const est = ESTILO_CATEGORIA[c.categoria] ?? PADRAO;
            return (
              <div key={c.categoria} style={{ textAlign: 'center', padding: '10px 2px 8px', borderRadius: 16,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 23, margin: '0 auto', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', border: `1.5px solid ${est.cor}`, boxShadow: `0 0 12px ${est.cor}44`,
                  background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(0,0,0,0.25))' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={est.cor} strokeWidth={1.8}
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {est.icone.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
                  </svg>
                </div>
                <div style={{ fontSize: 12, marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.categoria}</div>
                <div className="mutado" style={{ fontSize: 11, marginTop: 2 }}>{reais(c.total)}</div>
              </div>
            );
          })}
          {!categorias.length && <div className="mutado" style={{ gridColumn: '1 / -1', fontSize: 13 }}>Nenhum gasto neste mês.</div>}
        </div>
      </section>
    </main>
  );
}

function CartaoPequeno({ titulo, valor, rodape, aoTocar }: { titulo: string; valor: string; rodape: string; aoTocar?: () => void }) {
  return (
    <button className="vidro" onClick={aoTocar} style={{ padding: '14px 14px 14px 16px', textAlign: 'left' }}>
      <div className="mutado" style={{ fontSize: 14 }}>{titulo}</div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>{valor}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span className="mutado" style={{ fontSize: 13 }}>{rodape}</span>
        {aoTocar && <Icone nome="seta" tamanho={14} cor="#C9C2B7" />}
      </div>
    </button>
  );
}
