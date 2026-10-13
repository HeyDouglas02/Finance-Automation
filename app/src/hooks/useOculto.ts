import { createContext, useContext } from 'react';

/** Botão de olho: esconder valores. O App guarda o estado; a tela Mês tem o botão. */
export const OcultoContexto = createContext<{ oculto: boolean; alternar: () => void }>({ oculto: false, alternar: () => {} });
export const useOculto = () => useContext(OcultoContexto);

const CHAVE = 'finance:ocultar-valores';

// preferência só deste aparelho; sem acesso ao armazenamento, começa visível
export function lerOculto(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}
export function gravarOculto(valor: boolean) {
  try { localStorage.setItem(CHAVE, valor ? '1' : '0'); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
