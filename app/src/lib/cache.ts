import { QueryClient } from '@tanstack/react-query';

/**
 * Cache das consultas. Os dados só mudam com a sincronização (a cada 3h) ou
 * quando o app grava algo, então cada tela mostra na hora o que já buscou.
 * Recarrega sozinho ao voltar pro app depois de 1h; antes disso, puxar a tela
 * pra baixo recarrega (components/PuxarParaAtualizar.tsx).
 */
const UMA_HORA = 60 * 60 * 1000;

export const cliente = new QueryClient({
  defaultOptions: { queries: { staleTime: UMA_HORA, refetchOnWindowFocus: true, retry: 1 } },
});

/** Depois de gravar: tudo vem das views (saldo, acertos, categorias…), então marca tudo pra atualizar. */
export const dadosMudaram = () => cliente.invalidateQueries();
