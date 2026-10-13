import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarCompra, buscarOpcoes, classificar, type Compra, type Opcao, type Rateio } from '../lib/dados';
import { diaMesCurto, reais } from '../lib/formato';
import { Icone } from '../components/Icone';

/** Dono: minha (sem rateio), inteira de uma pessoa, ou dividida. */
type Dono = { tipo: 'minha' } | { tipo: 'pessoa'; id: number } | { tipo: 'dividir' };
/** Linha da divisão: texto do campo + se é R$ ou %. */
type Parte = { texto: string; unidade: 'valor' | 'percentual' };

/** Tela satélite: classificar uma compra (regra 11). Parcela: vale para ela e as seguintes. */
export function Classificar() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const [compra, setCompra] = useState<Compra | null>(null);
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [pessoas, setPessoas] = useState<Opcao[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [dono, setDono] = useState<Dono>({ tipo: 'minha' });
  const [partes, setPartes] = useState<Record<number, Parte>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([buscarCompra(id), buscarOpcoes()]).then(([c, o]) => {
      setCompra(c);
      setCategorias(o.categorias);
      setPessoas(o.pessoas);
      // categoria atual vale como sugestão, menos "A revisar" (não está na lista)
      setCategoriaId(o.categorias.some(x => x.id === c.categoriaId) ? c.categoriaId : null);
      // monta o dono a partir dos rateios que já existem
      // inteira de uma pessoa: 100% ou valor fixo igual ao da compra (como veio da importação)
      const r0 = c.rateios[0];
      const inteira = c.rateios.length === 1 && (r0.percentual === 100 || Math.abs((r0.valor ?? 0) - Math.abs(c.valor)) < 0.005);
      setDono(!c.rateios.length ? { tipo: 'minha' } : inteira ? { tipo: 'pessoa', id: c.rateios[0].pessoa_id } : { tipo: 'dividir' });
      setPartes(Object.fromEntries(c.rateios.map(r => [r.pessoa_id,
        r.percentual !== null ? { texto: String(r.percentual), unidade: 'percentual' } : { texto: String(r.valor), unidade: 'valor' }])));
    }).catch(e => setErro(e.message));
  }, [id]);

  if (!compra) {
    return <main className="tela">{erro ? <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erro}</div> : <div className="mutado">Carregando…</div>}</main>;
  }

  const total = Math.abs(compra.valor);
  // "12,5" ou "12.5" → 12.5; vazio ou inválido → 0
  const numero = (texto: string) => Number(texto.replace(',', '.')) || 0;
  const rateios: Rateio[] = dono.tipo === 'minha' ? []
    : dono.tipo === 'pessoa' ? [{ pessoa_id: dono.id, valor: null, percentual: 100 }]
    : Object.entries(partes).filter(([, p]) => numero(p.texto) > 0).map(([pid, p]) => ({
        pessoa_id: Number(pid),
        valor: p.unidade === 'valor' ? numero(p.texto) : null,
        percentual: p.unidade === 'percentual' ? numero(p.texto) : null,
      }));
  const dosOutros = rateios.reduce((t, r) => t + (r.valor ?? total * (r.percentual ?? 0) / 100), 0);
  const minhaParte = total - dosOutros;
  const passou = minhaParte < -0.005;
  const podeConfirmar = categoriaId !== null && !passou && !salvando && !(dono.tipo === 'dividir' && !rateios.length);

  const confirmar = async () => {
    if (categoriaId === null) return;
    setSalvando(true);
    setErro('');
    try {
      await classificar(compra.id, categoriaId, rateios);
      navegar(-1);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  const parcela = compra.parcelaNum !== null && compra.parcelaTotal !== null;

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button aria-label="Voltar" onClick={() => navegar(-1)}
          style={{ width: 36, height: 36, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)' }}>
          <Icone nome="seta" tamanho={22} />
        </button>
        <h1 className="titulo">Classificar</h1>
      </header>

      <section className="vidro" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{compra.descricao}</span>
          <span style={{ fontSize: 18, fontWeight: 800, flexShrink: 0 }}>R$ {reais(compra.valor)}</span>
        </div>
        <div className="mutado" style={{ fontSize: 13, marginTop: 4 }}>
          {[compra.cartao, diaMesCurto(compra.data), parcela ? `${compra.parcelaNum} de ${compra.parcelaTotal}` : null].filter(Boolean).join(' · ')}
        </div>
      </section>

      <Titulo>De quem é?</Titulo>
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
            const mudar = (m: Partial<Parte>) => setPartes({ ...partes, [p.id]: { ...parte, ...m } });
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <label htmlFor={`parte-${p.id}`} style={{ flex: 1, fontSize: 15 }}>{p.nome}</label>
                <input id={`parte-${p.id}`} inputMode="decimal" placeholder="0" value={parte.texto} onChange={e => mudar({ texto: e.target.value })}
                  className="pilula" style={{ width: 96, height: 40, padding: '0 12px', textAlign: 'right', fontSize: 15 }} />
                <button className="pilula" aria-label={`${p.nome}: trocar entre reais e porcentagem`}
                  onClick={() => mudar({ unidade: parte.unidade === 'valor' ? 'percentual' : 'valor' })}
                  style={{ width: 48, height: 40, fontSize: 14, fontWeight: 600 }}>
                  {parte.unidade === 'valor' ? 'R$' : '%'}
                </button>
              </div>
            );
          })}
        </section>
      )}

      <div style={{ fontSize: 14, padding: '0 4px', color: passou ? 'var(--negativo)' : 'var(--texto-2)' }}>
        {passou ? `A divisão passa do valor da compra em R$ ${reais(-minhaParte)}` : <>Sua parte: <b style={{ color: 'var(--texto)' }}>R$ {reais(minhaParte)}</b></>}
      </div>

      <Titulo>Categoria</Titulo>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {categorias.map(c => <Chip key={c.id} ativo={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>{c.nome}</Chip>)}
      </div>

      {parcela && (
        <p className="mutado" style={{ fontSize: 13, margin: '4px 4px 0', lineHeight: 1.5 }}>
          Vale para esta parcela e as seguintes ({compra.parcelaNum} de {compra.parcelaTotal} em diante). As anteriores não mudam.
        </p>
      )}

      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}

      <button className="botao-mel" disabled={!podeConfirmar} onClick={confirmar} style={{ marginTop: 4 }}>
        {salvando ? 'Salvando…' : 'Confirmar'}
      </button>
    </main>
  );
}

function Titulo({ children }: { children: string }) {
  return <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>{children}</div>;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} aria-pressed={ativo} className={ativo ? undefined : 'pilula'}
      style={{ height: 40, padding: '0 16px', borderRadius: 999, fontSize: 14,
        ...(ativo ? { border: '1.5px solid var(--mel)', background: 'rgba(242,184,75,0.14)', color: 'var(--mel)', fontWeight: 600 } : {}) }}>
      {children}
    </button>
  );
}
