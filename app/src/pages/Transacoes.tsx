import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buscarTransacoes, type Lancamento } from '../lib/dados';
import { diaMesCurto, mesAtual, reais } from '../lib/formato';
import { SeletorMes } from '../components/SeletorMes';
import { TituloAba } from '../components/BotaoOlho';

/** Aba Transações: tudo do mês, agrupado como no resumo do saldo. Filtros: Pendentes e um grupo (vindo do resumo). */
export function Transacoes() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const competencia = params.get('mes') ?? mesAtual();
  const grupoFiltro = params.get('grupo');
  const categoriaFiltro = params.get('categoria');
  const soPendentes = params.get('filtro') === 'pendentes';

  const consulta = useQuery({ queryKey: ['transacoes', competencia], queryFn: () => buscarTransacoes(competencia) });
  const erro = consulta.error?.message ?? '';
  const itens: Lancamento[] | null = consulta.data ?? (consulta.error ? [] : null);   // null = carregando

  // filtros moram na URL: o "voltar" e o link do resumo do saldo funcionam sem estado extra
  const filtrar = (mudancas: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    navegar(`/transacoes?${p}`, { replace: true });
  };

  const pendentes = (itens ?? []).filter(i => i.pendente).length;
  // categoria: igual ao card do Mês (sua parte, sem renda; sem categoria = "Sem categoria")
  const daCategoria = (i: Lancamento) => i.tipo !== 'Renda' && i.minhaParte !== 0 && (i.categoria ?? 'Sem categoria') === categoriaFiltro;
  const visiveis = (itens ?? []).filter(i => (!soPendentes || i.pendente) && (!grupoFiltro || i.grupo === grupoFiltro)
    && (!categoriaFiltro || daCategoria(i)));

  // mesma ordem do resumo do saldo: Renda primeiro, depois quem pesa mais na sua parte
  const grupos = new Map<string, Lancamento[]>();
  visiveis.forEach(i => grupos.set(i.grupo, [...(grupos.get(i.grupo) ?? []), i]));
  const soma = (l: Lancamento[]) => l.reduce((t, i) => t + i.minhaParte, 0);
  const ordenados = [...grupos].sort(([a, la], [b, lb]) => (a === 'Renda' ? -1 : b === 'Renda' ? 1 : soma(lb) - soma(la)));

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TituloAba>Transações</TituloAba>
      <SeletorMes competencia={competencia} rota="/transacoes" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Filtro ativo={!soPendentes} onClick={() => filtrar({ filtro: null })}>Todas</Filtro>
        <Filtro ativo={soPendentes} onClick={() => filtrar({ filtro: 'pendentes' })}>Pendentes ({pendentes})</Filtro>
        {grupoFiltro && (
          <Filtro ativo onClick={() => filtrar({ grupo: null })}>
            {grupoFiltro} <span aria-label="tirar filtro" style={{ marginLeft: 4 }}>✕</span>
          </Filtro>
        )}
        {categoriaFiltro && (
          <Filtro ativo onClick={() => filtrar({ categoria: null })}>
            {categoriaFiltro} <span aria-label="tirar filtro" style={{ marginLeft: 4 }}>✕</span>
          </Filtro>
        )}
      </div>

      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {erro}</div>}
      {itens === null && <div className="mutado">Carregando…</div>}
      {itens && !erro && !visiveis.length && (
        <div className="mutado" style={{ padding: '8px 4px' }}>
          {soPendentes ? 'Nada pendente: todas as compras deste mês já foram classificadas.' : 'Nada neste mês.'}
        </div>
      )}

      {ordenados.map(([grupo, lista]) => (
        <section key={grupo} className="vidro" style={{ padding: '4px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 8px', fontSize: 15, fontWeight: 600 }}>
            <span>{grupo}</span>
            <span>{grupo === 'Renda' ? '+ ' : ''}R$ {reais(soma(lista))}</span>
          </div>
          {lista.map(i => (
            <LinhaTransacao key={i.ref} item={i}
              // só compras reais do cartão são classificáveis; o resto é previsão ou lançamento manual
              aoTocar={i.ref.startsWith('tx:') ? () => navegar(`/classificar/${i.ref.slice(3)}`) : undefined} />
          ))}
        </section>
      ))}
    </main>
  );
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={ativo ? undefined : 'pilula'}
      style={{ height: 36, padding: '0 14px', borderRadius: 999, fontSize: 14, display: 'flex', alignItems: 'center',
        ...(ativo ? { border: '1.5px solid var(--mel)', background: 'rgba(242,184,75,0.14)', color: 'var(--mel)', fontWeight: 600 } : {}) }}>
      {children}
    </button>
  );
}

function LinhaTransacao({ item: i, aoTocar }: { item: Lancamento; aoTocar?: () => void }) {
  const renda = i.tipo === 'Renda';
  const detalhes = [i.data ? diaMesCurto(i.data) : null, renda ? null : i.categoria, i.status === 'Real' || i.status === 'Manual' ? null : i.status]
    .filter(Boolean).join(' · ');
  const Raiz = aoTocar ? 'button' : 'div';
  return (
    <Raiz onClick={aoTocar} style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.descricao}</span>
          {i.pendente && (
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--mel)', border: '1px solid rgba(242,184,75,0.5)',
              borderRadius: 999, padding: '1px 7px' }}>Revisar</span>
          )}
        </span>
        {detalhes && <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{detalhes}</span>}
        {/* valor diferente do esperado: conta fixa cobrada diferente ou parcela que mudou */}
        {i.divergencia && <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: 'var(--mel)' }}>⚠ {divergenciaLegivel(i.divergencia)}</span>}
      </span>
      <span style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: renda ? 'var(--mel)' : undefined }}>
          {renda ? '+ ' : ''}R$ {reais(i.minhaParte !== 0 || renda ? i.minhaParte : i.valor)}
        </span>
        {!renda && i.minhaParte !== i.valor && (
          <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
            {i.minhaParte === 0 ? `${i.pessoas.join(' e ')} ${i.pessoas.length > 1 ? 'pagam' : 'paga'}` : `de R$ ${reais(i.valor)}`}
          </span>
        )}
      </span>
    </Raiz>
  );
}

/** "Esperado 1,234.50" (formato do banco) → "Esperado R$ 1.234,50" */
function divergenciaLegivel(texto: string): string {
  const m = texto.match(/^(.*) ([\d.,]+)$/);
  return m ? `${m[1]} R$ ${reais(Number(m[2].replace(/,/g, '')))}` : texto;
}
