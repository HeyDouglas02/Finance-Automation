import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { buscarConexoes, buscarContasFixas, buscarPessoas } from '../lib/dados';
import { mesAtual } from '../lib/formato';
import { supabase } from '../lib/supabase';
import { Icone } from '../components/Icone';
import { TituloAba } from '../components/BotaoOlho';

/** Aba Mais: menu de cadastros e configurações; cada item abre uma subtela (/mais/:secao). */
export function Mais() {
  const navegar = useNavigate();
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const conexoes = useQuery({ queryKey: ['conexoes'], queryFn: buscarConexoes }).data;
  const pessoas = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas }).data?.filter(p => !p.arquivada);
  const contas = useQuery({ queryKey: ['contasFixas'], queryFn: buscarContasFixas }).data;

  // o mesmo critério de erro da subtela Bancos
  const comErro = conexoes?.filter(c => c.status !== 'UPDATED' || (c.execucao !== null && c.execucao !== 'SUCCESS')).length ?? 0;
  const ativas = contas?.filter(f => !f.fim || f.fim >= mesAtual()).length;
  const plural = (n: number | undefined, um: string, varios: string) => n === undefined ? '' : `${n} ${n === 1 ? um : varios}`;

  const itens: { secao: string; nome: string; resumo: string; alerta?: boolean }[] = [
    { secao: 'bancos', nome: 'Bancos', resumo: comErro ? plural(comErro, 'banco com erro', 'bancos com erro') : plural(conexoes?.length, 'conectado', 'conectados'), alerta: comErro > 0 },
    { secao: 'pessoas', nome: 'Pessoas', resumo: plural(pessoas?.length, 'pessoa', 'pessoas') },
    { secao: 'contas-fixas', nome: 'Contas fixas', resumo: plural(ativas, 'conta', 'contas') },
    { secao: 'limites', nome: 'Limites do mês', resumo: '' },
  ];

  return (
    <main className="tela" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TituloAba>Mais</TituloAba>

      <section className="vidro" style={{ padding: '4px 16px' }}>
        {itens.map((item, i) => (
          <button key={item.secao} onClick={() => navegar(`/mais/${item.secao}`)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', textAlign: 'left',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{item.nome}</span>
            <span className={item.alerta ? undefined : 'mutado'} style={{ fontSize: 13, color: item.alerta ? 'var(--negativo)' : undefined }}>{item.resumo}</span>
            <Icone nome="seta" tamanho={16} cor="#C9C2B7" />
          </button>
        ))}
      </section>

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
