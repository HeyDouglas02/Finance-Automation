import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { arquivarConexao, buscarConexoes, codigoConexaoValido, conectarBanco, type Conexao } from '../lib/dados';
import { quandoLegivel } from '../lib/formato';
import { Icone } from './Icone';

// o Meu Pluggy vai ao banco 1×/dia: passou de 36h sem atualizar, algo travou
const HORAS_ATRASO = 36;

/** Banco recém-cadastrado: a sincronização ainda não passou por ele. */
export const aguardando = (c: Conexao) => c.status === null;
export const comErro = (c: Conexao) => !aguardando(c) && (c.status !== 'UPDATED' || (c.execucao !== null && c.execucao !== 'SUCCESS'));

/** Bancos (regra 21): status de cada conexão do Meu Pluggy, conectar (colando o código), desconectar e reconectar. */
export function Conexoes() {
  const consulta = useQuery({ queryKey: ['conexoes'], queryFn: buscarConexoes });
  const todas = consulta.data ?? [];
  const [aberta, setAberta] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [verDesconectados, setVerDesconectados] = useState(false);

  const ativas = todas.filter(c => !c.arquivada);
  const desconectados = todas.filter(c => c.arquivada);

  return <>
    {consulta.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {consulta.error.message}</div>}
    <section className="vidro" style={{ padding: '4px 16px' }}>
      {ativas.map((c, i) => (
        <LinhaConexao key={c.itemId} conexao={c} primeira={i === 0}
          aberta={aberta === c.itemId} alternar={() => setAberta(aberta === c.itemId ? null : c.itemId)} />
      ))}
      {consulta.data && !ativas.length && <div className="mutado" style={{ padding: '12px 0', fontSize: 14 }}>Nenhum banco conectado.</div>}
      <div style={{ borderTop: ativas.length ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: '10px 0' }}>
        {conectando
          ? <NovoBanco todas={todas} fechar={() => setConectando(false)} />
          : <button onClick={() => setConectando(true)} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14 }}>+ Conectar banco</button>}
      </div>
    </section>
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      O Meu Pluggy busca no banco 1 vez por dia, no horário dele. O app lê do Meu Pluggy a cada 3 horas, e os cartões de um banco novo aparecem sozinhos na primeira leitura.
    </p>

    {desconectados.length > 0 && (
      <button onClick={() => setVerDesconectados(!verDesconectados)} className="mutado" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '0 4px' }}>
        {verDesconectados ? 'Esconder desconectados' : `Ver desconectados (${desconectados.length})`}
      </button>
    )}
    {verDesconectados && (
      <section className="vidro" style={{ padding: '4px 16px' }}>
        {desconectados.map((c, i) => (
          <div key={c.itemId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ flex: 1, fontSize: 15 }}>{c.contas}</span>
            <BotaoReconectar itemId={c.itemId} />
          </div>
        ))}
      </section>
    )}
  </>;
}

function LinhaConexao({ conexao: c, primeira, aberta, alternar }: { conexao: Conexao; primeira: boolean; aberta: boolean; alternar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const horas = c.ultimaAtualizacao ? (Date.now() - new Date(c.ultimaAtualizacao).getTime()) / 3_600_000 : Infinity;
  const atrasado = !aguardando(c) && !comErro(c) && horas > HORAS_ATRASO;
  const cor = comErro(c) ? 'var(--negativo)' : atrasado || aguardando(c) ? 'var(--mel)' : 'var(--positivo)';
  const situacao = aguardando(c) ? 'Aguardando a sincronização'
    : comErro(c) ? `Erro: ${c.status}${c.execucao ? ` / ${c.execucao}` : ''}` : atrasado ? `Sem atualizar há ${Math.floor(horas)}h` : 'Conectado';

  const desconectar = async () => {
    setSalvando(true);
    setErro('');
    try { await arquivarConexao(c.itemId, true); dadosMudaram(); alternar(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  return (
    <div style={{ padding: '12px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={alternar} aria-expanded={aberta} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: cor, boxShadow: `0 0 6px ${cor}`, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{c.contas}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: cor }}>{situacao}</span>
        <span style={{ display: 'flex', transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={14} cor="#C9C2B7" /></span>
      </button>
      {!aguardando(c) && (
        <div className="mutado" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6, paddingLeft: 16 }}>
          <div>Banco atualizado: {c.ultimaAtualizacao ? quandoLegivel(c.ultimaAtualizacao) : '—'}</div>
          <div>Lido pelo app: {c.sincronizadoEm ? quandoLegivel(c.sincronizadoEm) : '—'}</div>
          {c.avisos && <div style={{ color: 'var(--mel)' }}>{c.avisos}</div>}
        </div>
      )}
      {aberta && (
        <div style={{ marginTop: 10, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
          {confirmando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ flex: 1 }}>Desconectar? As compras novas deste banco param de chegar.</span>
              <button className="mutado" onClick={() => setConfirmando(false)}>Cancelar</button>
              <button disabled={salvando} onClick={desconectar} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Desconectar</button>
            </div>
          ) : (
            <button className="pilula" onClick={() => setConfirmando(true)} style={{ height: 44, fontSize: 14 }}>Desconectar</button>
          )}
        </div>
      )}
    </div>
  );
}

function NovoBanco({ todas, fechar }: { todas: Conexao[]; fechar: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const valido = codigoConexaoValido(codigo);
  const existente = todas.find(c => c.itemId === codigo.trim().toLowerCase());

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try { await conectarBanco(codigo); dadosMudaram(); fechar(); } catch (e) { setErro((e as Error).message); setSalvando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor="novo-banco" className="mutado" style={{ fontSize: 12, lineHeight: 1.5 }}>
        No Meu Pluggy, conecte o banco, abra a conexão e copie o código dela (item id).
      </label>
      <input id="novo-banco" placeholder="00000000-0000-0000-0000-000000000000" value={codigo} onChange={e => setCodigo(e.target.value)}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
        className="pilula" style={{ height: 40, padding: '0 12px', fontSize: 14, width: '100%' }} />
      {codigo.trim() && !valido && <div style={{ color: 'var(--negativo)', fontSize: 13 }}>Esse código não parece um código de conexão.</div>}
      {existente && (existente.arquivada
        ? <div style={{ fontSize: 13 }}>Esse banco está desconectado. Use "Reconectar" em "Ver desconectados".</div>
        : <div style={{ color: 'var(--negativo)', fontSize: 13 }}>Esse banco já está conectado.</div>)}
      {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pilula" onClick={fechar} style={{ flex: 1, height: 44, fontSize: 14 }}>Cancelar</button>
        <button className="botao-mel" disabled={salvando || !valido || !!existente} onClick={salvar}
          style={{ flex: 1, height: 44, fontSize: 14 }}>{salvando ? 'Salvando…' : 'Conectar'}</button>
      </div>
    </div>
  );
}

function BotaoReconectar({ itemId }: { itemId: string }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const reconectar = async () => {
    setSalvando(true);
    setErro('');
    try { await arquivarConexao(itemId, false); dadosMudaram(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  return <>
    {erro && <span role="alert" style={{ color: 'var(--negativo)', fontSize: 12 }}>{erro}</span>}
    <button disabled={salvando} onClick={reconectar} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14 }}>{salvando ? '…' : 'Reconectar'}</button>
  </>;
}
