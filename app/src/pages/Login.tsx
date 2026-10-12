import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

/** Tela de login com e-mail e senha (o único usuário é o dono). */
export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEntrando(false);
    if (error) setErro('E-mail ou senha incorretos.');
  }

  const campo = { width: '100%', height: 52, padding: '0 18px', fontSize: 16, outline: 'none' } as const;

  return (
    <main className="tela" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Finance</div>
        <div className="mutado" style={{ marginTop: 6 }}>Suas finanças fechadas mês a mês</div>
      </div>
      <form onSubmit={entrar} className="vidro" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label htmlFor="email" className="mutado" style={{ fontSize: 13 }}>E-mail</label>
        <input id="email" className="pilula" style={campo} type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="senha" className="mutado" style={{ fontSize: 13, marginTop: 4 }}>Senha</label>
        <input id="senha" className="pilula" style={campo} type="password" autoComplete="current-password" required
          value={senha} onChange={e => setSenha(e.target.value)} />
        {erro && <div role="alert" style={{ color: 'var(--negativo)', fontSize: 14 }}>{erro}</div>}
        <button className="botao-mel" style={{ marginTop: 8 }} disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
