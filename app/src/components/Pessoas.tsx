import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { arquivarPessoa, buscarPessoas, criarPessoa, editarPessoa, mesmoNome, type Pessoa } from '../lib/dados';
import { telefoneLegivel } from '../lib/formato';
import { Icone } from './Icone';

/** Pessoas com quem se divide (regra 19): incluir, editar, arquivar e restaurar. Nada é excluído. */
export function Pessoas() {
  const consulta = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas });
  const todas: Pessoa[] | null = consulta.data ?? null;
  const erro = consulta.error?.message ?? '';
  const [aberta, setAberta] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false);

  const ativas = todas?.filter(p => !p.arquivada) ?? [];
  const arquivadas = todas?.filter(p => p.arquivada) ?? [];

  return <>
    {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {erro}</div>}
    {todas === null && !erro && <div className="mutado">Carregando…</div>}
    {todas && (
      <section className="vidro" style={{ padding: '4px 16px' }}>
        {ativas.map((p, i) => (
          <LinhaPessoa key={p.id} pessoa={p} todas={todas} primeira={i === 0}
            aberta={aberta === p.id} alternar={() => setAberta(aberta === p.id ? null : p.id)} />
        ))}
        <div style={{ borderTop: ativas.length ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: '10px 0' }}>
          {criando
            ? <NovaPessoa todas={todas} fechar={() => setCriando(false)} />
            : <button onClick={() => setCriando(true)} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14 }}>+ Nova pessoa</button>}
        </div>
      </section>
    )}
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      O telefone é usado no botão "Cobrar no WhatsApp" do Fechamento. Arquivar tira a pessoa da divisão; o que ela deve continua no Fechamento.
    </p>

    {arquivadas.length > 0 && (
      <button onClick={() => setVerArquivadas(!verArquivadas)} className="mutado" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '0 4px' }}>
        {verArquivadas ? 'Esconder arquivadas' : `Ver arquivadas (${arquivadas.length})`}
      </button>
    )}
    {verArquivadas && (
      <section className="vidro" style={{ padding: '4px 16px' }}>
        {arquivadas.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ flex: 1, fontSize: 15 }}>{p.nome}</span>
            <BotaoAcao rotulo="Restaurar" acao={() => arquivarPessoa(p.id, false)} />
          </div>
        ))}
      </section>
    )}
  </>;
}

function LinhaPessoa({ pessoa: p, todas, primeira, aberta, alternar }: {
  pessoa: Pessoa; todas: Pessoa[]; primeira: boolean; aberta: boolean; alternar: () => void;
}) {
  const [nome, setNome] = useState(p.nome);
  const [telefone, setTelefone] = useState(p.telefone ? telefoneLegivel(p.telefone) : '');
  const [arquivando, setArquivando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const repetida = todas.find(o => o.id !== p.id && mesmoNome(o.nome, nome));

  const executar = async (tarefa: () => Promise<void>) => {
    setSalvando(true);
    setErro('');
    try { await tarefa(); dadosMudaram(); alternar(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  return (
    <div style={{ padding: '10px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={alternar} aria-expanded={aberta} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{p.nome}</span>
          <span className="mutado" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{p.telefone ? telefoneLegivel(p.telefone) : 'Sem telefone'}</span>
        </span>
        <span style={{ display: 'flex', transform: aberta ? 'rotate(180deg)' : 'none' }}><Icone nome="baixo" tamanho={14} cor="#C9C2B7" /></span>
      </button>

      {aberta && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CamposPessoa id={`p${p.id}`} nome={nome} setNome={setNome} telefone={telefone} setTelefone={setTelefone} />
          {repetida && <div style={{ color: 'var(--negativo)', fontSize: 13 }}>Já existe {repetida.arquivada ? 'uma pessoa arquivada' : 'outra pessoa'} com esse nome.</div>}
          {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
          {arquivando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ flex: 1 }}>Arquivar {p.nome}?</span>
              <button className="mutado" onClick={() => setArquivando(false)}>Cancelar</button>
              <button disabled={salvando} onClick={() => executar(() => arquivarPessoa(p.id, true))} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Arquivar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pilula" onClick={() => setArquivando(true)} style={{ flex: 1, height: 44, fontSize: 14 }}>Arquivar</button>
              <button className="botao-mel" disabled={salvando || !nome.trim() || !!repetida}
                onClick={() => executar(() => editarPessoa(p.id, nome, telefone))}
                style={{ flex: 1, height: 44, fontSize: 14 }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NovaPessoa({ todas, fechar }: { todas: Pessoa[]; fechar: () => void }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const repetida = nome.trim() ? todas.find(o => mesmoNome(o.nome, nome)) : undefined;

  const executar = async (tarefa: () => Promise<void>) => {
    setSalvando(true);
    setErro('');
    try { await tarefa(); dadosMudaram(); fechar(); } catch (e) { setErro((e as Error).message); setSalvando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <CamposPessoa id="nova-pessoa" nome={nome} setNome={setNome} telefone={telefone} setTelefone={setTelefone} />
      {/* nome de uma arquivada: restaura a mesma pessoa, para o histórico não se dividir em duas */}
      {repetida && (repetida.arquivada ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ flex: 1 }}>{repetida.nome} está arquivada.</span>
          <button disabled={salvando} onClick={() => executar(() => arquivarPessoa(repetida.id, false))}
            style={{ color: 'var(--mel)', fontWeight: 700 }}>Restaurar</button>
        </div>
      ) : <div style={{ color: 'var(--negativo)', fontSize: 13 }}>{repetida.nome} já está na lista.</div>)}
      {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pilula" onClick={fechar} style={{ flex: 1, height: 44, fontSize: 14 }}>Cancelar</button>
        <button className="botao-mel" disabled={salvando || !nome.trim() || !!repetida}
          onClick={() => executar(() => criarPessoa(nome, telefone))}
          style={{ flex: 1, height: 44, fontSize: 14 }}>{salvando ? 'Salvando…' : 'Adicionar'}</button>
      </div>
    </div>
  );
}

function CamposPessoa({ id, nome, setNome, telefone, setTelefone }: {
  id: string; nome: string; setNome: (t: string) => void; telefone: string; setTelefone: (t: string) => void;
}) {
  const campo = { className: 'pilula', style: { height: 40, padding: '0 12px', fontSize: 15, width: '100%' } };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Rotulado id={`${id}-nome`} rotulo="Nome"><input id={`${id}-nome`} placeholder="Ex.: Duda" value={nome} onChange={e => setNome(e.target.value)} {...campo} /></Rotulado>
      <Rotulado id={`${id}-tel`} rotulo="Telefone (opcional)">
        <input id={`${id}-tel`} type="tel" inputMode="tel" placeholder="(41) 99999-8888" value={telefone} onChange={e => setTelefone(e.target.value)} {...campo} />
      </Rotulado>
    </div>
  );
}

function BotaoAcao({ rotulo, acao }: { rotulo: string; acao: () => Promise<void> }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const executar = async () => {
    setSalvando(true);
    setErro('');
    try { await acao(); dadosMudaram(); } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  return <>
    {erro && <span role="alert" style={{ color: 'var(--negativo)', fontSize: 12 }}>{erro}</span>}
    <button disabled={salvando} onClick={executar} style={{ color: 'var(--mel)', fontWeight: 600, fontSize: 14 }}>{salvando ? '…' : rotulo}</button>
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
