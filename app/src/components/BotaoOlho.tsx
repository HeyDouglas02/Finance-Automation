import { useOculto } from '../hooks/useOculto';
import { Icone } from './Icone';

/** Olho: esconde/mostra todos os valores em reais do app. */
export function BotaoOlho() {
  const { oculto, alternar } = useOculto();
  return (
    <button aria-label={oculto ? 'Mostrar valores' : 'Esconder valores'} aria-pressed={oculto} onClick={alternar}
      style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icone nome={oculto ? 'olhoFechado' : 'olho'} tamanho={22} cor="#E8E2D8" />
    </button>
  );
}

/** Título das abas com o olho à direita. */
export function TituloAba({ children }: { children: string }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginRight: -10 }}>
      <h1 className="titulo">{children}</h1>
      <BotaoOlho />
    </header>
  );
}
