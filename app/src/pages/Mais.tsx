import { useEffect, useState } from 'react';
import { buscarPessoas, normalizarTelefone, salvarTelefone, type Pessoa } from '../lib/dados';
import { telefoneLegivel } from '../lib/formato';

/** Aba Mais: por enquanto, o telefone de cada pessoa (usado em "Cobrar no WhatsApp"). */
export function Mais() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => { buscarPessoas().then(setPessoas).catch(e => setErro(e.message)); }, []);

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="titulo">Mais</h1>

      <div style={{ fontSize: 15, fontWeight: 600, margin: '6px 4px 0' }}>Pessoas</div>
      {erro && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {erro}</div>}
      {pessoas === null && !erro && <div className="mutado">Carregando…</div>}
      {pessoas && (
        <section className="vidro" style={{ padding: '4px 16px' }}>
          {pessoas.map((p, i) => <LinhaPessoa key={p.id} pessoa={p} primeira={i === 0} />)}
        </section>
      )}
      <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
        O telefone é usado no botão "Cobrar no WhatsApp" dos Acertos. Digite com DDD.
      </p>
    </main>
  );
}

function LinhaPessoa({ pessoa, primeira }: { pessoa: Pessoa; primeira: boolean }) {
  const [salvo, setSalvo] = useState(pessoa.telefone);
  const [texto, setTexto] = useState(pessoa.telefone ? telefoneLegivel(pessoa.telefone) : '');
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo'>('');
  const [erro, setErro] = useState('');

  const mudou = normalizarTelefone(texto) !== salvo;

  const salvar = async () => {
    setEstado('salvando');
    setErro('');
    try {
      const novo = await salvarTelefone(pessoa.id, texto);
      setSalvo(novo);
      setTexto(novo ? telefoneLegivel(novo) : '');
      setEstado('salvo');
    } catch (e) {
      setErro((e as Error).message);
      setEstado('');
    }
  };

  return (
    <div style={{ padding: '10px 0', borderTop: primeira ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label htmlFor={`tel-${pessoa.id}`} style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{pessoa.nome}</label>
        <input id={`tel-${pessoa.id}`} type="tel" inputMode="tel" placeholder="(41) 99999-8888" value={texto}
          onChange={e => { setTexto(e.target.value); setEstado(''); }}
          className="pilula" style={{ width: 170, height: 40, padding: '0 12px', fontSize: 15 }} />
        <button onClick={salvar} disabled={!mudou || estado === 'salvando'}
          style={{ width: 64, height: 40, fontSize: 14, fontWeight: 600, color: mudou ? 'var(--mel)' : 'var(--texto-2)' }}>
          {estado === 'salvando' ? '…' : estado === 'salvo' && !mudou ? 'Salvo' : 'Salvar'}
        </button>
      </div>
      {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 12, marginTop: 4 }}>{erro}</div>}
    </div>
  );
}
