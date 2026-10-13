import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { buscarContasFixas, criarContaFixa, encerrarContaFixa, mudarValorContaFixa, type ContaFixa } from '../lib/dados';
import { mesAtual, nomeMes, reais } from '../lib/formato';
import { Chip } from './Divisao';
import { Icone } from './Icone';

// "12,5" ou "12.5" → 12.5; vazio ou inválido → 0
const numero = (texto: string) => Number(texto.replace(',', '.')) || 0;
// <input type="month"> trabalha com "2026-10"; o banco com "2026-10-01"
const paraMes = (competencia: string) => competencia.slice(0, 7);
const doMes = (mes: string) => `${mes}-01`;

/** Contas fixas (regra 3): ver, criar, mudar valor (encerra a antiga e cria nova) e encerrar. */
export function ContasFixas() {
  const consulta = useQuery({ queryKey: ['contasFixas'], queryFn: buscarContasFixas });
  const [aberta, setAberta] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [verEncerradas, setVerEncerradas] = useState(false);

  const atual = mesAtual();
  const todas = consulta.data ?? [];
  const ativas = todas.filter(f => !f.fim || f.fim >= atual);
  const encerradas = todas.filter(f => f.fim && f.fim < atual);
  const totalMes = ativas.filter(f => f.inicio <= atual).reduce((t, f) => t + f.valor, 0);

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 4px 0' }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>Contas fixas</span>
      {ativas.length > 0 && <span className="mutado" style={{ fontSize: 13 }}>{ativas.length} contas · R$ {reais(totalMes)}/mês</span>}
    </div>
    {consulta.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {consulta.error.message}</div>}

    <section className="vidro" style={{ padding: '4px 16px' }}>
      {ativas.map((f, i) => (
        <LinhaConta key={f.id} conta={f} primeira={i === 0} aberta={aberta === f.id} alternar={() => setAberta(aberta === f.id ? null : f.id)} />
      ))}
      <div style={{ borderTop: ativas.length ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: '10px 0' }}>
        {criando
          ? <NovaConta fechar={() => setCriando(false)} />
          : <button onClick={() => setCriando(true)} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14 }}>+ Nova conta fixa</button>}
      </div>
    </section>

    {encerradas.length > 0 && (
      <button onClick={() => setVerEncerradas(!verEncerradas)} className="mutado" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '0 4px' }}>
        {verEncerradas ? 'Esconder encerradas' : `Ver encerradas (${encerradas.length})`}
      </button>
    )}
    {verEncerradas && (
      <section className="vidro" style={{ padding: '4px 16px' }}>
        {encerradas.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14,
            borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span>{f.nome} <span className="mutado" style={{ fontSize: 12 }}>até {nomeMes(f.fim!).toLowerCase()}</span></span>
            <span className="mutado">R$ {reais(f.valor)}</span>
          </div>
        ))}
      </section>
    )}
  </>;
}

function LinhaConta({ conta: f, primeira, aberta, alternar }: { conta: ContaFixa; primeira: boolean; aberta: boolean; alternar: () => void }) {
  const [acao, setAcao] = useState<'valor' | 'encerrar' | null>(null);
  const [valor, setValor] = useState('');
  const [mes, setMes] = useState(paraMes(mesAtual()));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const detalhe = [f.forma === 'credito' ? `Crédito${f.textoFatura ? ` · ${f.textoFatura}` : ''}` : 'Débito',
    f.inicio > mesAtual() ? `a partir de ${nomeMes(f.inicio).toLowerCase()}` : null,
    f.fim ? `até ${nomeMes(f.fim).toLowerCase()}` : null].filter(Boolean).join(' · ');

  const executar = async (tarefa: () => Promise<void>) => {
    setSalvando(true);
    setErro('');
    try { await tarefa(); setAcao(null); dadosMudaram(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  return (
    <div style={{ padding: '10px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={alternar} aria-expanded={aberta} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{f.nome}</span>
          <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{detalhe}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>R$ {reais(f.valor)}</span>
        <span style={{ display: 'flex', transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={14} cor="#C9C2B7" /></span>
      </button>

      {aberta && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip ativo={acao === 'valor'} onClick={() => setAcao('valor')}>Mudar valor</Chip>
            <Chip ativo={acao === 'encerrar'} onClick={() => setAcao('encerrar')}>Encerrar</Chip>
          </div>
          {acao && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {acao === 'valor' && (
                <Rotulado id={`valor-${f.id}`} rotulo="Novo valor">
                  <input id={`valor-${f.id}`} inputMode="decimal" placeholder={reais(f.valor)} value={valor} onChange={e => setValor(e.target.value)}
                    className="pilula" style={{ width: 110, height: 40, padding: '0 12px', fontSize: 15 }} />
                </Rotulado>
              )}
              <Rotulado id={`mes-${f.id}`} rotulo={acao === 'valor' ? 'A partir de' : 'Último mês'}>
                <input id={`mes-${f.id}`} type="month" value={mes} onChange={e => setMes(e.target.value)}
                  className="pilula" style={{ height: 40, padding: '0 12px', fontSize: 15 }} />
              </Rotulado>
              <button className="botao-mel" disabled={salvando || !mes || (acao === 'valor' && numero(valor) <= 0)}
                style={{ width: 'auto', height: 40, padding: '0 18px', fontSize: 14 }}
                onClick={() => executar(acao === 'valor'
                  ? () => mudarValorContaFixa(f.id, numero(valor), doMes(mes))
                  : () => encerrarContaFixa(f.id, doMes(mes)))}>
                {salvando ? '…' : 'Confirmar'}
              </button>
            </div>
          )}
          {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
        </div>
      )}
    </div>
  );
}

function NovaConta({ fechar }: { fechar: () => void }) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<'debito' | 'credito'>('debito');
  const [texto, setTexto] = useState('');
  const [mes, setMes] = useState(paraMes(mesAtual()));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      await criarContaFixa({ nome, valor: numero(valor), forma, inicio: doMes(mes), textoFatura: texto });
      dadosMudaram();
      fechar();
    } catch (e) { setErro((e as Error).message); setSalvando(false); }
  };

  const campo = { className: 'pilula', style: { height: 40, padding: '0 12px', fontSize: 15, width: '100%' } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Rotulado id="nova-nome" rotulo="Nome"><input id="nova-nome" placeholder="Ex.: Spotify" value={nome} onChange={e => setNome(e.target.value)} {...campo} /></Rotulado>
      <div style={{ display: 'flex', gap: 8 }}>
        <Rotulado id="nova-valor" rotulo="Valor"><input id="nova-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} {...campo} /></Rotulado>
        <Rotulado id="nova-mes" rotulo="Começa em"><input id="nova-mes" type="month" value={mes} onChange={e => setMes(e.target.value)} {...campo} /></Rotulado>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Chip ativo={forma === 'debito'} onClick={() => setForma('debito')}>Débito</Chip>
        <Chip ativo={forma === 'credito'} onClick={() => setForma('credito')}>Crédito</Chip>
      </div>
      {forma === 'credito' && (
        <Rotulado id="nova-texto" rotulo="Como aparece na fatura">
          <input id="nova-texto" placeholder="Ex.: SPOTIFY" value={texto} onChange={e => setTexto(e.target.value)} {...campo} />
        </Rotulado>
      )}
      {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pilula" onClick={fechar} style={{ flex: 1, height: 44, fontSize: 14 }}>Cancelar</button>
        <button className="botao-mel" onClick={salvar} disabled={salvando || !nome.trim() || numero(valor) <= 0 || !mes || (forma === 'credito' && !texto.trim())}
          style={{ flex: 1, height: 44, fontSize: 14 }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </div>
  );
}

function Rotulado({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <label htmlFor={id} className="mutado" style={{ fontSize: 12 }}>{rotulo}</label>
      {children}
    </div>
  );
}
