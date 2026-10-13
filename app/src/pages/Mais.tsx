import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { buscarPessoas, normalizarTelefone, salvarTelefone, type Pessoa } from '../lib/dados';
import { telefoneLegivel } from '../lib/formato';
import { supabase } from '../lib/supabase';
import { ContasFixas } from '../components/ContasFixas';
import { TituloAba } from '../components/BotaoOlho';

/** Aba Mais: telefones (cobrança no WhatsApp), contas fixas e sair. */
export function Mais() {
  const consulta = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas });
  const pessoas: Pessoa[] | null = consulta.data ?? null;
  const erro = consulta.error?.message ?? '';
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TituloAba>Mais</TituloAba>

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

      <ContasFixas />

      {/* sair pede confirmação: o login é com e-mail e senha, chato de refazer no celular */}
      <section className="vidro" style={{ padding: '4px 16px', marginTop: 14 }}>
        {confirmarSaida ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', fontSize: 15 }}>
            <span style={{ flex: 1 }}>Sair do app?</span>
            <button className="mutado" onClick={() => setConfirmarSaida(false)}>Cancelar</button>
            <button onClick={() => supabase.auth.signOut()} style={{ color: 'var(--negativo)', fontWeight: 700 }}>Sair</button>
          </div>
        ) : (
          <button onClick={() => setConfirmarSaida(true)} style={{ width: '100%', textAlign: 'left', padding: '12px 0', fontSize: 15, color: 'var(--negativo)' }}>
            Sair
          </button>
        )}
      </section>
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
      dadosMudaram();   // botão do WhatsApp nos Acertos usa o telefone
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
