import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chave) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo app/.env');
}

/**
 * Cliente do Supabase usado pelo app.
 * Usa só a chave pública (anon): sem login, ela não acessa nada.
 * Depois do login, o RLS do banco libera os dados apenas para o dono.
 */
export const supabase = createClient(url, chave);
