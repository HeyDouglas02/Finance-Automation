import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dadosMudaram } from '../lib/cache';
import { buscarPerfil, salvarPerfil } from '../lib/dados';

/** Perfil (regra 22): nome (o "Olá" da tela Mês) e chave Pix da cobrança pelo WhatsApp. */
export function Perfil() {
  const consulta = useQuery({ queryKey: ['perfil'], queryFn: buscarPerfil });
  const [nome, setNome] = useState('');
  const [pix, setPix] = useState('');
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo'>('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (consulta.data) { setNome(consulta.data.nome ?? ''); setPix(consulta.data.chavePix ?? ''); }
  }, [consulta.data]);

  const mudou = nome.trim() !== (consulta.data?.nome ?? '') || pix.trim() !== (consulta.data?.chavePix ?? '');

  const salvar = async () => {
    setEstado('salvando');
    setErro('');
    try { await salvarPerfil(nome, pix); setEstado('salvo'); dadosMudaram(); } catch (e) { setErro((e as Error).message); setEstado(''); }
  };

  const campo = { className: 'pilula', style: { height: 44, padding: '0 12px', fontSize: 15, width: '100%' } };
  const mudar = (f: (t: string) => void) => (e: { target: { value: string } }) => { f(e.target.value); setEstado(''); };

  return <>
    {consulta.error && <div role="alert" style={{ color: 'var(--negativo)' }}>Erro: {consulta.error.message}</div>}
    <section className="vidro" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor="perfil-nome" className="mutado" style={{ fontSize: 12 }}>Seu nome</label>
      <input id="perfil-nome" placeholder="Ex.: Duda" value={nome} onChange={mudar(setNome)} {...campo} />
      <label htmlFor="chave-pix" className="mutado" style={{ fontSize: 12, marginTop: 4 }}>Chave Pix (e-mail, telefone, CPF ou chave aleatória)</label>
      <input id="chave-pix" value={pix} onChange={mudar(setPix)} autoCapitalize="off" autoCorrect="off" spellCheck={false} {...campo} />
      {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 13 }}>{erro}</div>}
      <button className="botao-mel" disabled={!mudou || estado === 'salvando'} onClick={salvar} style={{ height: 44, fontSize: 14, marginTop: 4 }}>
        {estado === 'salvando' ? 'Salvando…' : estado === 'salvo' && !mudou ? 'Salvo' : 'Salvar'}
      </button>
    </section>
    <p className="mutado" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 4px' }}>
      O nome aparece no "Olá" da tela Mês. A chave Pix vai no fim da mensagem de cobrança do WhatsApp; sem chave, a mensagem vai sem a linha do Pix.
    </p>
  </>;
}
