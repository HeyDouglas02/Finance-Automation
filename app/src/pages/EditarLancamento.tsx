import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { dadosMudaram } from '../lib/cache';
import { buscarEditavel, excluirLancado, type Lancado } from '../lib/dados';
import { FormDebito, FormGasolina, FormRenda } from '../components/FormsLancamento';
import { Icone } from '../components/Icone';

const TITULOS: Record<Lancado['tipo'], string> = { renda: 'Corrigir renda', debito: 'Corrigir débito', gasolina: 'Corrigir gasolina' };

/** Tela satélite: corrigir ou excluir uma renda, um débito ou uma gasolina lançados à mão. */
export function EditarLancamento() {
  const params = useParams();
  const tipo = params.tipo as Lancado['tipo'];
  const id = Number(params.id);
  const navegar = useNavigate();
  const consulta = useQuery({ queryKey: ['editavel', tipo, id], queryFn: () => buscarEditavel(tipo, id) });
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');

  // salvou ou excluiu: saldo, transações e acertos dependem disso
  const pronto = () => { dadosMudaram(); navegar(-1); };
  const excluir = async () => {
    setErro('');
    try { await excluirLancado(tipo, id); pronto(); } catch (e) { setErro((e as Error).message); }
  };

  const e = consulta.data;
  const parcelado = e?.tipo === 'debito' && e.parcelas > 1;

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button aria-label="Voltar" onClick={() => navegar(-1)}
          style={{ width: 36, height: 36, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)' }}>
          <Icone nome="seta" tamanho={22} />
        </button>
        <h1 className="titulo">{TITULOS[tipo] ?? 'Corrigir'}</h1>
      </header>

      {consulta.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro ao carregar: {consulta.error.message}</div>}
      {!e && !consulta.error && <div className="mutado">Carregando…</div>}

      {/* formulário só monta com os dados na mão: ele começa preenchido com o que está gravado */}
      {e?.tipo === 'renda' && <FormRenda competencia={e.competencia} salvou={pronto} editando={e} />}
      {e?.tipo === 'debito' && <FormDebito competencia={e.competencia} salvou={pronto} editando={e} />}
      {e?.tipo === 'gasolina' && <FormGasolina salvou={pronto} editando={e} />}

      {e && (
        <section className="vidro" style={{ padding: '4px 16px', marginTop: 10 }}>
          {confirmar ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', fontSize: 15 }}>
              <span style={{ flex: 1 }}>{parcelado ? 'Excluir todas as parcelas?' : 'Excluir este lançamento?'}</span>
              <button className="mutado" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button onClick={excluir} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Excluir</button>
            </div>
          ) : (
            <button onClick={() => setConfirmar(true)} style={{ width: '100%', textAlign: 'left', padding: '12px 0', fontSize: 15, color: 'var(--negativo)' }}>
              Excluir lançamento
            </button>
          )}
        </section>
      )}
      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>{erro}</div>}
      {parcelado && <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>Débito parcelado: corrigir ou excluir vale pra todas as parcelas.</p>}
    </main>
  );
}
