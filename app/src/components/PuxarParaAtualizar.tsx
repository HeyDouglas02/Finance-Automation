import { useEffect, useRef, useState } from 'react';
import { cliente } from '../lib/cache';
import { Icone } from './Icone';

const LIMIAR = 70;    // quanto puxar (px, já amortecido) pra valer
const MAXIMO = 110;

/**
 * Puxar a tela pra baixo recarrega os dados do banco (não chama a Pluggy).
 * Só vale com a página no topo, pra não brigar com a rolagem normal.
 */
export function PuxarParaAtualizar() {
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => {
    let inicio: number | null = null;
    let distancia = 0;

    const comecar = (e: TouchEvent) => {
      inicio = window.scrollY <= 0 && !ocupado.current ? e.touches[0].clientY : null;
    };
    const mover = (e: TouchEvent) => {
      if (inicio === null) return;
      if (window.scrollY > 0) { inicio = null; distancia = 0; setPuxado(0); return; }   // virou rolagem
      distancia = Math.min(MAXIMO, Math.max(0, (e.touches[0].clientY - inicio) * 0.5));   // amortece: o dedo anda o dobro
      setPuxado(distancia);
    };
    const soltar = async () => {
      if (inicio === null) return;
      inicio = null;
      const valeu = distancia >= LIMIAR;
      distancia = 0;
      setPuxado(0);
      if (!valeu) return;
      ocupado.current = true;
      setAtualizando(true);
      // busca de novo tudo que está na tela; o resto atualiza quando for aberto
      await Promise.all([cliente.invalidateQueries(), new Promise(r => setTimeout(r, 500))]);
      setAtualizando(false);
      ocupado.current = false;
    };

    window.addEventListener('touchstart', comecar, { passive: true });
    window.addEventListener('touchmove', mover, { passive: true });
    window.addEventListener('touchend', soltar);
    return () => {
      window.removeEventListener('touchstart', comecar);
      window.removeEventListener('touchmove', mover);
      window.removeEventListener('touchend', soltar);
    };
  }, []);

  if (!puxado && !atualizando) return null;
  const pronto = puxado >= LIMIAR;
  const texto = atualizando ? 'Atualizando…' : pronto ? 'Solte pra atualizar' : 'Puxe pra atualizar';

  return (
    <div role="status" className="pilula" style={{
      position: 'fixed', left: '50%', top: 'calc(env(safe-area-inset-top) + 10px)', zIndex: 20,
      transform: `translate(-50%, ${atualizando ? 0 : puxado - LIMIAR / 2}px)`,
      opacity: atualizando ? 1 : Math.min(1, puxado / LIMIAR),
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
      color: pronto || atualizando ? 'var(--mel)' : 'var(--texto-2)', background: 'rgba(20,18,16,0.92)',
    }}>
      <span style={{ display: 'flex', transform: pronto && !atualizando ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        animation: atualizando ? 'girar 0.8s linear infinite' : 'none' }}>
        <Icone nome={atualizando ? 'atualizar' : 'baixo'} tamanho={14} />
      </span>
      {texto}
    </div>
  );
}
