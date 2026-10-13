import { QueryClient } from '@tanstack/react-query';

/**
 * Cache das consultas. Os dados só mudam quando a sincronização roda (06:00)
 * ou quando o app grava algo, então nada "envelhece" sozinho: cada aba busca
 * uma vez e depois mostra na hora. Recarregar o app (ou sincronizar) busca de novo.
 */
export const cliente = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 } },
});

/** Depois de gravar: tudo vem das views (saldo, acertos, categorias…), então marca tudo pra atualizar. */
export const dadosMudaram = () => cliente.invalidateQueries();
