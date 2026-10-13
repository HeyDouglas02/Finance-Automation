import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { diaMesCurto, mesAtual, nomeMes, reais, reaisComSinal, venceOuVenceu } from '../lib/formato';
import {
  buscarAReceber, buscarCategorias, buscarFatura, buscarParcelamentos, buscarResumo, buscarSaidas,
  type AReceber, type Categoria, type Fatura, type LinhaSaida, type Parcela, type ResumoMes,
} from '../lib/dados';
import { Icone } from '../components/Icone';
import { Anel } from '../components/Anel';
import { SeletorMes } from '../components/SeletorMes';

/** Cor e ícone de cada categoria no cartão "Categorias". */
const ESTILO_CATEGORIA: Record<string, { cor: string; icone: string }> = {
  'Conta fixa': { cor: '#F2B84B', icone: 'M3 11l9-7 9 7 M5 10v9h14v-9' },
  'Mercado': { cor: '#F2B84B', icone: 'M4 7h16l-1.5 12h-13z M8 7l4 5 4-5' },
  'Gasolina': { cor: '#F0533F', icone: 'M5 20V6a2 2 0 012-2h6a2 2 0 012 2v14 M4 20h12' },
  'Roupa': { cor: '#F2B84B', icone: 'M16 4l-4 2-4-2-4 3 2 3v10h12V10l2-3z' },
};
const PADRAO = { cor: '#F2B84B', icone: 'M4 5h16v14H4z M8 10h8 M8 14h4' };

const TITULO_FATURA = { fechada: 'Fatura', aberta: 'Fatura aberta', prevista: 'Fatura prevista' } as const;

export function Mes() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const competencia = params.get('mes') ?? mesAtual();

  const [resumo, setResumo] = useState<ResumoMes | null | undefined>(undefined);
  const [fatura, setFatura] = useState<Fatura>(null);
  const [receber, setReceber] = useState<AReceber>({ total: 0, pessoas: 0 });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erro, setErro] = useState('');
  const [verFaturas, setVerFaturas] = useState(false);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [verParcelas, setVerParcelas] = useState(false);
  const [saidas, setSaidas] = useState<LinhaSaida[]>([]);
  const [verResumo, setVerResumo] = useState(false);


  useEffect(() => {
    let valido = true;   // trocou de mês antes da resposta chegar: descarta a antiga
    setResumo(undefined);
    setErro('');
    Promise.all([
      buscarResumo(competencia),
      buscarFatura(competencia),
      buscarAReceber(competencia),
      buscarCategorias(competencia),
      buscarParcelamentos(competencia),
      buscarSaidas(competencia),
    ]).then(([r, f, a, c, p, s]) => { if (valido) { setResumo(r); setFatura(f); setReceber(a); setCategorias(c); setParcelas(p); setSaidas(s); } })
      .catch(e => { if (valido) { setErro(e.message); setResumo(null); } });
    setVerFaturas(false);
    setVerParcelas(false);
    setVerResumo(false);
    return () => { valido = false; };
  }, [competencia]);

  const saldo = resumo?.saldo ?? 0;
  const fracao = resumo && resumo.renda > 0 ? resumo.saidas / resumo.renda : 0;
  const estourou = fracao > 1;
  const abrirGrupo = (grupo: string) => navegar(`/transacoes?mes=${competencia}&grupo=${encodeURIComponent(grupo)}`);

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

      <SeletorMes competencia={competencia} rota="/" />

      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erro}</div>}

      <section className="vidro" style={{ padding: '18px 18px 16px' }}>
        <button onClick={() => resumo && setVerResumo(!verResumo)} aria-expanded={verResumo} disabled={!resumo}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, fontWeight: 600 }}>
          Saldo do mês
          {resumo && <span style={{ display: 'flex', transform: verResumo ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={16} cor="#C9C2B7" /></span>}
        </button>
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
            {verResumo && (
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, fontSize: 14 }}>
                <LinhaResumo nome="Renda" valor={`+ ${reais(resumo.renda)}`} cor="var(--mel)" aoTocar={() => abrirGrupo('Renda')} />
                {saidas.map(s => <LinhaResumo key={s.nome} nome={s.nome} valor={`− ${reais(s.valor)}`} aoTocar={() => abrirGrupo(s.nome)} />)}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6 }}>
                  <LinhaResumo nome="Saldo" valor={saldo < 0 ? `− ${reais(-saldo)}` : `+ ${reais(saldo)}`} cor={saldo < 0 ? 'var(--negativo)' : 'var(--positivo)'} forte />
                </div>
              </div>
            )}
          </>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* valor grande = o que o banco mostra (mês futuro: só existe o previsto); previsão aparece à parte */}
        <CartaoPequeno titulo={fatura ? TITULO_FATURA[fatura.situacao] : 'Fatura'}
          valor={fatura ? `R$ ${reais(fatura.situacao === 'prevista' ? fatura.previsto : fatura.real)}` : '—'}
          rodape={!fatura ? 'Sem compras no cartão'
            : fatura.situacao === 'aberta' && fatura.previsto > 0 ? `+ R$ ${reais(fatura.previsto)} previsto`
            : `${venceOuVenceu(fatura.vencimento)} ${diaMesCurto(fatura.vencimento)}`}
          aoTocar={fatura ? () => setVerFaturas(!verFaturas) : undefined} aberto={verFaturas} />
        <CartaoPequeno titulo="A receber" valor={`R$ ${reais(receber.total)}`}
          rodape={receber.pessoas ? `${receber.pessoas} ${receber.pessoas === 1 ? 'pessoa' : 'pessoas'}` : 'Tudo recebido'}
          aoTocar={() => navegar(`/acertos?mes=${competencia}`)} />
      </div>

      {verFaturas && fatura && (
        <section className="vidro" style={{ padding: '6px 16px', marginTop: -2 }}>
          {fatura.porCartao.map((f, i) => (
            <div key={f.cartao} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0',
              borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{f.cartao}</span>
                <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                  {f.fechada ? 'Fechada' : f.total === f.previsto ? 'Prevista' : 'Aberta'} · {venceOuVenceu(f.vencimento).toLowerCase()} {diaMesCurto(f.vencimento)}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>R$ {reais(f.total)}</span>
                {f.previsto > 0 && f.total !== f.previsto &&
                  <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{reais(f.previsto)} previsto</span>}
              </span>
            </div>
          ))}
        </section>
      )}

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

      {parcelas.length > 0 && <CartaoParcelamentos parcelas={parcelas} aberto={verParcelas} alternar={() => setVerParcelas(!verParcelas)} />}
    </main>
  );
}

function CartaoPequeno({ titulo, valor, rodape, aoTocar, aberto }: { titulo: string; valor: string; rodape: string; aoTocar?: () => void; aberto?: boolean }) {
  return (
    <button className="vidro" onClick={aoTocar} style={{ padding: '14px 14px 14px 16px', textAlign: 'left' }}>
      <div className="mutado" style={{ fontSize: 14 }}>{titulo}</div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>{valor}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span className="mutado" style={{ fontSize: 13 }}>{rodape}</span>
        {/* aberto definido = expande no lugar (seta pra baixo/cima); senão navega (seta pro lado) */}
        {aoTocar && (aberto === undefined
          ? <Icone nome="seta" tamanho={14} cor="#C9C2B7" />
          : <span style={{ display: 'flex', transform: aberto ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={14} cor="#C9C2B7" /></span>)}
      </div>
    </button>
  );
}

/** Parcelamentos do mês: resumo da sua parte; aberto, separa as suas das de outras pessoas. */
function CartaoParcelamentos({ parcelas, aberto, alternar }: { parcelas: Parcela[]; aberto: boolean; alternar: () => void }) {
  const suas = parcelas.filter(p => p.minhaParte > 0).sort((a, b) => b.minhaParte - a.minhaParte);
  const minhaParte = suas.reduce((t, p) => t + p.minhaParte, 0);
  const ultima = suas.reduce((u, p) => (p.ultima > u ? p.ultima : u), '');

  // um grupo por pessoa, cada item com a parte dela (dividida aparece em "Suas" e no grupo da pessoa)
  const porPessoa = new Map<string, { parcela: Parcela; parte: number }[]>();
  parcelas.forEach(p => p.pessoas.forEach(({ nome, valor }) =>
    porPessoa.set(nome, [...(porPessoa.get(nome) ?? []), { parcela: p, parte: valor }])));
  const grupos = [...porPessoa.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([nome, itens]) => [nome, itens.sort((a, b) => b.parte - a.parte)] as const);

  return (
    <section className="vidro" style={{ padding: '14px 16px' }}>
      <button onClick={alternar} aria-expanded={aberto}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span>
          <span className="mutado" style={{ display: 'block', fontSize: 14 }}>Parcelamentos (sua parte)</span>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 700, marginTop: 4 }}>R$ {reais(minhaParte)}</span>
          <span className="mutado" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
            {suas.length
              ? `${suas.length} ${suas.length === 1 ? 'compra sua' : 'compras suas'} · última em ${nomeMes(ultima).toLowerCase()}`
              : 'Nenhuma parcela sua neste mês'}
          </span>
        </span>
        <span style={{ display: 'flex', marginTop: 2, transform: aberto ? 'rotate(180deg)' : 'none' }}>
          <Icone nome="baixo" tamanho={16} cor="#C9C2B7" />
        </span>
      </button>
      {aberto && <>
        {suas.length > 0 && <GrupoParcelas titulo="Suas" itens={suas.map(p => ({ parcela: p, parte: p.minhaParte }))} />}
        {grupos.map(([nome, itens]) => <GrupoParcelas key={nome} titulo={nome} itens={itens} />)}
      </>}
    </section>
  );
}

function GrupoParcelas({ titulo, itens }: { titulo: string; itens: { parcela: Parcela; parte: number }[] }) {
  const total = itens.reduce((t, i) => t + i.parte, 0);
  return (
    <div style={{ marginTop: 14 }}>
      <div className="mutado" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600,
        letterSpacing: 0.8, textTransform: 'uppercase', paddingBottom: 4 }}>
        <span>{titulo}</span><span>R$ {reais(total)}</span>
      </div>
      {itens.map(({ parcela: p, parte }) => (
        <div key={p.descricao + p.cartao + p.total} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.descricao}</span>
            <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
              {p.num} de {p.total}{p.status === 'Previsto' ? ' (prevista)' : ''} · {p.valorRestante > 0 ? `falta R$ ${reais(p.valorRestante)}` : 'última'}
            </span>
          </span>
          <span style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>R$ {reais(parte)}</span>
            {parte !== p.valor &&
              <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>de R$ {reais(p.valor)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function LinhaResumo({ nome, valor, cor, forte = false, aoTocar }: { nome: string; valor: string; cor?: string; forte?: boolean; aoTocar?: () => void }) {
  const conteudo = <>
    <span className={forte ? undefined : 'mutado'}>{nome}</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: cor, fontWeight: forte ? 700 : 600 }}>
      {valor}{aoTocar && <Icone nome="seta" tamanho={12} cor="#C9C2B7" />}
    </span>
  </>;
  const estilo = { width: '100%', display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontWeight: forte ? 700 : 400 } as const;
  // linha tocável abre Transações já filtrada no grupo
  return aoTocar ? <button onClick={aoTocar} style={estilo}>{conteudo}</button> : <div style={estilo}>{conteudo}</div>;
}
