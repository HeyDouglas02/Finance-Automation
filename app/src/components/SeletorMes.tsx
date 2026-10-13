import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { buscarPrimeiroMes } from '../lib/dados';
import { nomeMes, somaMes } from '../lib/formato';
import { Icone } from './Icone';

/** ‹ [📅 Outubro 2026 ⌄] › — setas andam um mês (sem empilhar histórico); a pílula abre a tela Meses. */
export function SeletorMes({ competencia, rota }: { competencia: string; rota: string }) {
  const navegar = useNavigate();
  // só trava a seta; se falhar, segue livre
  const primeiroMes = useQuery({ queryKey: ['primeiroMes'], queryFn: buscarPrimeiroMes }).data ?? null;

  const noInicio = primeiroMes !== null && competencia <= primeiroMes;
  const ir = (mes: string) => navegar(`${rota}?mes=${mes}`, { replace: true });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button className="pilula" aria-label="Mês anterior" disabled={noInicio} onClick={() => ir(somaMes(competencia, -1))}
        style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)',
          opacity: noInicio ? 0.35 : 1 }}>
        <Icone nome="seta" tamanho={18} cor="#E8E2D8" />
      </button>
      <button className="pilula" onClick={() => navegar(`/meses?mes=${competencia}&para=${encodeURIComponent(rota)}`)}
        style={{ flex: 1, height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, fontWeight: 500 }}>
        <Icone nome="calendario" tamanho={18} cor="#E8E2D8" />
        {nomeMes(competencia)}
        <Icone nome="baixo" tamanho={16} cor="#E8E2D8" />
      </button>
      <button className="pilula" aria-label="Próximo mês" onClick={() => ir(somaMes(competencia, 1))}
        style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icone nome="seta" tamanho={18} cor="#E8E2D8" />
      </button>
    </div>
  );
}
