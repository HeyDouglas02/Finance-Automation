import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarCompra, buscarOpcoes, classificar, type Compra, type Opcao } from '../lib/dados';
import { diaMesCurto, reais } from '../lib/formato';
import { Icone } from '../components/Icone';
import { Chip, DIVISAO_MINHA, Titulo, Divisao, calcularDivisao, estadoDeRateios, type EstadoDivisao } from '../components/Divisao';

/** Tela satélite: classificar uma compra (regra 11). Parcela: vale para ela e as seguintes. */
export function Classificar() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const [compra, setCompra] = useState<Compra | null>(null);
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [pessoas, setPessoas] = useState<Opcao[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [divisao, setDivisao] = useState<EstadoDivisao>(DIVISAO_MINHA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([buscarCompra(id), buscarOpcoes()]).then(([c, o]) => {
      setCompra(c);
      setCategorias(o.categorias);
      setPessoas(o.pessoas);
      // categoria atual vale como sugestão, menos "A revisar" (não está na lista)
      setCategoriaId(o.categorias.some(x => x.id === c.categoriaId) ? c.categoriaId : null);
      setDivisao(estadoDeRateios(c.rateios, Math.abs(c.valor)));
    }).catch(e => setErro(e.message));
  }, [id]);

  if (!compra) {
    return <main className="tela">{erro ? <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erro}</div> : <div className="mutado">Carregando…</div>}</main>;
  }

  const total = Math.abs(compra.valor);
  const { rateios, passou, incompleta } = calcularDivisao(divisao, total);
  const podeConfirmar = categoriaId !== null && !passou && !incompleta && !salvando;

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
      <Divisao pessoas={pessoas} estado={divisao} mudar={setDivisao} total={total} />

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
