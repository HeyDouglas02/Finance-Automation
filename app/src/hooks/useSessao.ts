import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { cliente } from '../lib/cache';

/**
 * Acompanha se existe alguém logado.
 * undefined = ainda verificando · null = deslogado · Session = logado
 */
export function useSessao() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, nova) => {
      if (evento === 'SIGNED_OUT') cliente.clear();   // saiu: nada de dado em memória
      setSessao(nova);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return sessao;
}
