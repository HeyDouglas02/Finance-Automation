import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarCompra, buscarOpcoes, classificar } from '../lib/dados';
import { diaMesCurto, reais } from '../lib/formato';
import { Icone } from '../components/Icone';
import { Chip, DIVISAO_MINHA, Titulo, Divisao, calcularDivisao, estadoDeRateios, type EstadoDivisao } from '../components/Divisao';

/** Tela satélite: classificar uma compra (regra 11). Parcela: vale para ela e as seguintes. */
export function Classificar() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const consulta = useQuery({ queryKey: ['compra', id], queryFn: () => buscarCompra(id) });
  const opcoes = useQuery({ queryKey: ['opcoes'], queryFn: buscarOpcoes }).data;
  const compra = consulta.data ?? null;
  const categorias = opcoes?.categorias ?? [];
  const pessoas = opcoes?.pessoas ?? [];
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [divisao, setDivisao] = useState<EstadoDivisao>(DIVISAO_MINHA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // preenche o formulário com o que já está gravado, quando compra e categorias chegam
  useEffect(() => {
    if (!compra || !opcoes) return;
    // categoria atual vale como sugestão (pendente vem sem categoria: nada marcado)
    setCategoriaId(opcoes.categorias.some(x => x.id === compra.categoriaId) ? compra.categoriaId : null);
    setDivisao(estadoDeRateios(compra.rateios, Math.abs(compra.valor)));
  }, [compra, opcoes]);

  if (!compra) {
    const erroCarga = consulta.error?.message;
    return <main className="tela">{erroCarga ? <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erroCarga}</div> : <div className="mutado">Carregando…</div>}</main>;
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
      dadosMudaram();   // saldo, categorias, acertos… dependem da classificação
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
