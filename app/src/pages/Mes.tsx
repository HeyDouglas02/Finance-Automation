import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { mesAtual, nomeMes, reais, reaisComSinal } from '../lib/formato';
import { Icone } from '../components/Icone';

type LinhaMes = { competencia: string; renda: number | null; saidas: number; sobra: number };

/**
 * Tela Mês (passo 1: só o cartão do saldo, lendo dados reais).
 * Os outros cartões entram no passo 2.
 */
export function Mes() {
  const [competencia] = useState(mesAtual());
  const [mes, setMes] = useState<LinhaMes | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('v_mes').select('competencia, renda, saidas, sobra')
      .eq('competencia', competencia).maybeSingle()
      .then(({ data, error }) => {
        if (error) setErro(error.message);
        else setMes(data as LinhaMes | null);
      });
  }, [competencia]);

  const saldo = Number(mes?.sobra ?? 0);

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 23, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 17, color: '#F2E4CF', background: 'radial-gradient(circle at 35% 30%, #6B5A48, #2A231C)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.14)' }}>D</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Olá, Douglas</div>
            <div className="mutado" style={{ fontSize: 13 }}>Tudo certo por aqui!</div>
          </div>
        </div>
        <button aria-label="Sair" title="Sair" onClick={() => supabase.auth.signOut()}
          style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome="sino" tamanho={22} cor="#E8E2D8" />
        </button>
      </header>

      <button className="pilula" style={{ height: 44, padding: '0 14px', display: 'inline-flex', alignItems: 'center',
        gap: 10, alignSelf: 'flex-start', fontSize: 15, fontWeight: 500 }}>
        <Icone nome="calendario" tamanho={18} cor="#E8E2D8" />
        {nomeMes(competencia)}
        <span style={{ marginLeft: 18, display: 'flex' }}><Icone nome="baixo" tamanho={16} cor="#E8E2D8" /></span>
      </button>

      <section className="vidro" style={{ padding: '18px 18px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Saldo do mês</div>
        {erro ? (
          <div role="alert" style={{ color: 'var(--negativo)', marginTop: 8, fontSize: 14 }}>Erro ao carregar: {erro}</div>
        ) : mes === null ? (
          <div className="mutado" style={{ marginTop: 8 }}>Sem dados para este mês.</div>
        ) : (
          <>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.8, marginTop: 6,
              color: saldo < 0 ? 'var(--negativo)' : 'var(--texto)',
              textShadow: saldo < 0 ? '0 0 22px rgba(240,83,63,0.35)' : 'none' }}>
              {reaisComSinal(saldo)}
            </div>
            <div style={{ display: 'flex', gap: 26, marginTop: 10, fontSize: 14 }}>
              <span className="mutado">Entra <b style={{ color: 'var(--mel)', fontWeight: 600 }}>R$ {reais(Number(mes.renda ?? 0))}</b></span>
              <span className="mutado">Sai <b style={{ color: 'var(--negativo)', fontWeight: 600 }}>R$ {reais(Number(mes.saidas))}</b></span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
