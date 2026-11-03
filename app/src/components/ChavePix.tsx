import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { buscarChavePix, salvarChavePix } from '../lib/dados';

/** Chave Pix da cobrança pelo WhatsApp (regra 22). */
export function ChavePix() {
  const consulta = useQuery({ queryKey: ['chavePix'], queryFn: buscarChavePix });
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo'>('');
  const [erro, setErro] = useState('');

  useEffect(() => { if (consulta.data !== undefined) setTexto(consulta.data ?? ''); }, [consulta.data]);

  const mudou = texto.trim() !== (consulta.data ?? '');

  const salvar = async () => {
    setEstado('salvando');
    setErro('');
    try { await salvarChavePix(texto); setEstado('salvo'); dadosMudaram(); } catch (e) { setErro((e as Error).message); setEstado(''); }
  };

  return <>
    {consulta.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {consulta.error.message}</div>}
    <section className="vidro" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor="chave-pix" className="mutado" style={{ fontSize: 12 }}>Chave Pix (e-mail, telefone, CPF ou chave aleatória)</label>
      <input id="chave-pix" value={texto} onChange={e => { setTexto(e.target.value); setEstado(''); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
        className="pilula" style={{ height: 44, padding: '0 12px', fontSize: 15, width: '100%' }} />
      {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
      <button className="botao-mel" disabled={!mudou || estado === 'salvando'} onClick={salvar} style={{ height: 44, fontSize: 14 }}>
        {estado === 'salvando' ? 'Salvando…' : estado === 'salvo' && !mudou ? 'Salvo' : 'Salvar'}
      </button>
    </section>
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      Vai no fim da mensagem de cobrança do WhatsApp. Sem chave, a mensagem vai sem a linha do Pix.
    </p>
  </>;
}
