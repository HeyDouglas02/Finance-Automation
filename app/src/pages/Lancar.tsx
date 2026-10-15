import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buscarLancados, excluirLancado, type Lancado } from '../lib/dados';
import { mesAtual, nomeMes, reais } from '../lib/formato';
import { SeletorMes } from '../components/SeletorMes';
import { Chip } from '../components/Divisao';
import { FormDebito, FormGasolina, FormRenda } from '../components/FormsLancamento';
import { Icone } from '../components/Icone';
import { TituloAba } from '../components/BotaoOlho';

type Tipo = 'renda' | 'debito' | 'gasolina';
const NOMES: Record<Tipo, string> = { renda: 'Renda', debito: 'Débito', gasolina: 'Gasolina' };

/** Aba Lançar: renda, débito e gasolina (regras 2, 6 e 7). Embaixo, o que já foi lançado no mês: tocar corrige, ✕ exclui. */
export function Lancar() {
  const [params] = useSearchParams();
  const competencia = params.get('mes') ?? mesAtual();
  const [tipo, setTipo] = useState<Tipo>('renda');
  const [aviso, setAviso] = useState('');
  const lancados: Lancado[] | null = useQuery({ queryKey: ['lancados', competencia], queryFn: () => buscarLancados(competencia) }).data ?? null;

  const salvou = (texto: string) => { setAviso(texto); dadosMudaram(); };

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TituloAba>Lançar</TituloAba>
      {tipo !== 'gasolina' && <SeletorMes competencia={competencia} rota="/lancar" />}

      <div style={{ display: 'flex', gap: 8 }}>
        {(Object.keys(NOMES) as Tipo[]).map(t => (
          <Chip key={t} ativo={tipo === t} onClick={() => { setTipo(t); setAviso(''); }}>{NOMES[t]}</Chip>
        ))}
      </div>

      {tipo === 'renda' && <FormRenda competencia={competencia} salvou={salvou} />}
      {tipo === 'debito' && <FormDebito competencia={competencia} salvou={salvou} />}
      {tipo === 'gasolina' && <FormGasolina salvou={salvou} />}

      {aviso && <div role="status" style={{ color: 'var(--positivo)', fontSize: 14, padding: '0 4px' }}>{aviso}</div>}

      <ListaLancados competencia={competencia} lancados={lancados} mudou={dadosMudaram} />
    </main>
  );
}

function ListaLancados({ competencia, lancados, mudou }: { competencia: string; lancados: Lancado[] | null; mudou: () => void }) {
  const [aberta, setAberta] = useState(false);
  const navegar = useNavigate();
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  if (!lancados?.length) return null;

  const excluir = async (l: Lancado) => {
    setErro('');
    try { await excluirLancado(l.tipo, l.id); setConfirmar(null); mudou(); } catch (e) { setErro((e as Error).message); }
  };

  return <>
    {/* fechada por padrão: o foco da aba é lançar; a lista serve pra conferir e corrigir */}
    <section className="vidro" style={{ padding: '4px 16px', marginTop: 8 }}>
      <button onClick={() => setAberta(!aberta)} aria-expanded={aberta}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', fontSize: 15, fontWeight: 600 }}>
        <span>Lançados em {nomeMes(competencia).toLowerCase()} <span className="mutado" style={{ fontWeight: 400 }}>({lancados.length})</span></span>
        <span style={{ display: 'flex', transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={16} cor="#C9C2B7" /></span>
      </button>
      {aberta && lancados.map(l => (
        <div key={l.ref} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navegar(`/lancamento/${l.tipo}/${l.id}`)} aria-label={`Corrigir ${l.descricao}`}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</span>
                <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{NOMES[l.tipo]} · tocar pra corrigir</span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: l.tipo === 'renda' ? 'var(--mel)' : undefined }}>
                {l.tipo === 'renda' ? '+ ' : ''}R$ {reais(l.valor)}
              </span>
            </button>
            <button aria-label={`Excluir ${l.descricao}`} onClick={() => setConfirmar(confirmar === l.ref ? null : l.ref)}
              className="mutado" style={{ width: 32, height: 32, fontSize: 16 }}>✕</button>
          </div>
          {confirmar === l.ref && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{l.tipo === 'debito' && /\(\d+ de \d+\)$/.test(l.descricao) ? 'Excluir todas as parcelas?' : 'Excluir este lançamento?'}</span>
              <button onClick={() => setConfirmar(null)} className="mutado">Cancelar</button>
              <button onClick={() => excluir(l)} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Excluir</button>
            </div>
          )}
        </div>
      ))}
    </section>
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
  </>;
}
