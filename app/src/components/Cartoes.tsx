import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { arquivarCartao, buscarCartoes, editarCartao, mesmoNome, type Cartao } from '../lib/dados';
import { Icone } from './Icone';
import { Chip } from './Divisao';

/** Cartões (regra 20): os conectados nascem pela sincronização; aqui só edita, arquiva e restaura. */
export function Cartoes() {
  const consulta = useQuery({ queryKey: ['cartoes'], queryFn: buscarCartoes });
  const todos: Cartao[] | null = consulta.data ?? null;
  const erro = consulta.error?.message ?? '';
  const [aberto, setAberto] = useState<number | null>(null);
  const [verArquivados, setVerArquivados] = useState(false);

  const ativos = todos?.filter(c => !c.arquivado) ?? [];
  const arquivados = todos?.filter(c => c.arquivado) ?? [];

  return <>
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {erro}</div>}
    {todos === null && !erro && <div className="mutado">Carregando…</div>}
    {todos && (
      <section className="vidro" style={{ padding: '4px 16px' }}>
        {ativos.map((c, i) => (
          <LinhaCartao key={c.id} cartao={c} todos={todos} primeira={i === 0}
            aberto={aberto === c.id} alternar={() => setAberto(aberto === c.id ? null : c.id)} />
        ))}
        {!ativos.length && <div className="mutado" style={{ padding: '12px 0', fontSize: 14 }}>Nenhum cartão.</div>}
      </section>
    )}
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      Cartões de banco aparecem sozinhos quando o banco é conectado. Arquivar tira o cartão do Lançar e para de puxar compras novas; o histórico fica.
    </p>

    {arquivados.length > 0 && (
      <button onClick={() => setVerArquivados(!verArquivados)} className="mutado" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '0 4px' }}>
        {verArquivados ? 'Esconder arquivados' : `Ver arquivados (${arquivados.length})`}
      </button>
    )}
    {verArquivados && (
      <section className="vidro" style={{ padding: '4px 16px' }}>
        {arquivados.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ flex: 1, fontSize: 15 }}>{c.nome}</span>
            <BotaoRestaurar id={c.id} />
          </div>
        ))}
      </section>
    )}
  </>;
}

function LinhaCartao({ cartao: c, todos, primeira, aberto, alternar }: {
  cartao: Cartao; todos: Cartao[]; primeira: boolean; aberto: boolean; alternar: () => void;
}) {
  const [nome, setNome] = useState(c.nome);
  const [fecha, setFecha] = useState(String(c.diaFechamento));
  const [vence, setVence] = useState(String(c.diaVencimento));
  const [meses, setMeses] = useState(c.mesesAteVencer);
  const [arquivando, setArquivando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const dia = (t: string) => { const n = Number(t); return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null; };
  const repetido = todos.find(o => o.id !== c.id && mesmoNome(o.nome, nome));
  const mudouDias = dia(fecha) !== c.diaFechamento || dia(vence) !== c.diaVencimento || meses !== c.mesesAteVencer;
  const valido = nome.trim() && dia(fecha) && dia(vence) && !repetido;

  const executar = async (tarefa: () => Promise<void>) => {
    setSalvando(true);
    setErro('');
    try { await tarefa(); dadosMudaram(); alternar(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  const detalhe = `${c.conectado ? 'Banco' : 'Manual'} · fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}`;
  const campo = { className: 'pilula', style: { height: 40, padding: '0 12px', fontSize: 15, width: '100%' } };

  return (
    <div style={{ padding: '10px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={alternar} aria-expanded={aberto} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{c.nome}</span>
          <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{detalhe}</span>
          {c.diasEstimados && <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: 'var(--mel)', fontWeight: 600 }}>Confira os dias</span>}
        </span>
        <span style={{ display: 'flex', transform: aberto ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={14} cor="#C9C2B7" /></span>
      </button>

      {aberto && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Rotulado id={`c${c.id}-nome`} rotulo="Nome"><input id={`c${c.id}-nome`} value={nome} onChange={e => setNome(e.target.value)} {...campo} /></Rotulado>
          <div style={{ display: 'flex', gap: 8 }}>
            <Rotulado id={`c${c.id}-fecha`} rotulo="Dia que fecha"><input id={`c${c.id}-fecha`} inputMode="numeric" value={fecha} onChange={e => setFecha(e.target.value)} {...campo} /></Rotulado>
            <Rotulado id={`c${c.id}-vence`} rotulo="Dia que vence"><input id={`c${c.id}-vence`} inputMode="numeric" value={vence} onChange={e => setVence(e.target.value)} {...campo} /></Rotulado>
          </div>
          {/* só o manual usa: a gasolina é posta no mês pela regra do cartão; o conectado usa a fatura do banco */}
          {!c.conectado && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mutado" style={{ fontSize: 12, width: '100%' }}>A fatura vence</span>
              <Chip ativo={meses === 1} onClick={() => setMeses(1)}>No mês seguinte ao fechamento</Chip>
              <Chip ativo={meses === 2} onClick={() => setMeses(2)}>Dois meses depois</Chip>
            </div>
          )}
          {!c.conectado && mudouDias && <div className="mutado" style={{ fontSize: 12 }}>Mudar os dias recalcula o mês de toda a gasolina já anotada neste cartão.</div>}
          {repetido && <div style={{ color: 'var(--negativo)', fontSize: 13 }}>Já existe um cartão com esse nome.</div>}
          {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
          {arquivando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ flex: 1 }}>Arquivar {c.nome}?</span>
              <button className="mutado" onClick={() => setArquivando(false)}>Cancelar</button>
              <button disabled={salvando} onClick={() => executar(() => arquivarCartao(c.id, true))} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Arquivar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pilula" onClick={() => setArquivando(true)} style={{ flex: 1, height: 44, fontSize: 14 }}>Arquivar</button>
              <button className="botao-mel" disabled={salvando || !valido}
                onClick={() => executar(() => editarCartao(c.id, nome, dia(fecha)!, dia(vence)!, meses))}
                style={{ flex: 1, height: 44, fontSize: 14 }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BotaoRestaurar({ id }: { id: number }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const restaurar = async () => {
    setSalvando(true);
    setErro('');
    try { await arquivarCartao(id, false); dadosMudaram(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  return <>
    {erro && <span role="alert" style={{ color: 'var(--negativo)', fontSize: 12 }}>{erro}</span>}
    <button disabled={salvando} onClick={restaurar} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14 }}>{salvando ? '…' : 'Restaurar'}</button>
  </>;
}

function Rotulado({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <label htmlFor={id} className="mutado" style={{ fontSize: 12 }}>{rotulo}</label>
      {children}
    </div>
  );
}
