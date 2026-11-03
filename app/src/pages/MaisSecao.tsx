import { useNavigate, useParams } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { Conexoes } from '../components/Conexoes';
import { Pessoas } from '../components/Pessoas';
import { Cartoes } from '../components/Cartoes';
import { ContasFixas } from '../components/ContasFixas';
import { LimitesCategorias } from '../components/LimitesCategorias';
import { ChavePix } from '../components/ChavePix';

const SECOES: Record<string, { titulo: string; conteudo: () => JSX.Element }> = {
  bancos: { titulo: 'Bancos', conteudo: () => <Conexoes /> },
  cartoes: { titulo: 'Cartões', conteudo: () => <Cartoes /> },
  pessoas: { titulo: 'Pessoas', conteudo: () => <Pessoas /> },
  'contas-fixas': { titulo: 'Contas fixas', conteudo: () => <ContasFixas /> },
  limites: { titulo: 'Limites do mês', conteudo: () => <LimitesCategorias /> },
  pix: { titulo: 'Chave Pix', conteudo: () => <ChavePix /> },
};

/** Subtela da aba Mais, com "voltar" (como a tela Meses). */
export function MaisSecao() {
  const navegar = useNavigate();
  const secao = SECOES[useParams().secao ?? ''];

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <button aria-label="Voltar" onClick={() => navegar('/mais')}
          style={{ width: 36, height: 36, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)' }}>
          <Icone nome="seta" tamanho={22} />
        </button>
        <h1 className="titulo">{secao?.titulo ?? 'Mais'}</h1>
      </header>
      {secao ? secao.conteudo() : <div className="mutado">Tela não encontrada.</div>}
    </main>
  );
}
