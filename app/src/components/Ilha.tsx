import { NavLink } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';

const ABAS: { rota: string; nome: string; icone: NomeIcone }[] = [
  { rota: '/', nome: 'Mês', icone: 'mes' },
  { rota: '/revisar', nome: 'Revisar', icone: 'revisar' },
  { rota: '/lancar', nome: 'Lançar', icone: 'lancar' },
  { rota: '/acertos', nome: 'Acertos', icone: 'acertos' },
  { rota: '/mais', nome: 'Mais', icone: 'mais' },
];

/** A ilha de abas flutuante, em vidro, presa na parte de baixo da tela. */
export function Ilha() {
  return (
    <nav className="vidro" aria-label="Navegação principal" style={{
      position: 'fixed', left: 14, right: 14, bottom: 'calc(18px + env(safe-area-inset-bottom))',
      maxWidth: 452, margin: '0 auto', padding: 6, borderRadius: 999,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, zIndex: 10,
    }}>
      {ABAS.map(aba => (
        <NavLink key={aba.rota} to={aba.rota} end={aba.rota === '/'}
          style={({ isActive }) => ({
            height: 56, borderRadius: 999, textDecoration: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            fontSize: 11, fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--mel)' : '#D8D1C6',
            background: isActive ? 'linear-gradient(180deg, rgba(242,184,75,0.28), rgba(242,184,75,0.12))' : 'transparent',
            boxShadow: isActive ? 'inset 0 1px 0 rgba(255,220,150,0.35), 0 0 18px -4px rgba(242,184,75,0.55)' : 'none',
          })}>
          <Icone nome={aba.icone} />
          {aba.nome}
        </NavLink>
      ))}
    </nav>
  );
}
