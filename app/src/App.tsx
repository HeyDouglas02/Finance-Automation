import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useSessao } from './hooks/useSessao';
import { Ilha } from './components/Ilha';
import { Login } from './pages/Login';
import { Mes } from './pages/Mes';
import { Meses } from './pages/Meses';
import { Transacoes } from './pages/Transacoes';
import { Classificar } from './pages/Classificar';
import { Acertos } from './pages/Acertos';
import { Mais } from './pages/Mais';
import { EmBreve } from './pages/EmBreve';

export function App() {
  const sessao = useSessao();

  if (sessao === undefined) return null;   // verificando o login
  if (sessao === null) return <Login />;    // deslogado

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Mes />} />
        <Route path="/meses" element={<Meses />} />
        <Route path="/transacoes" element={<Transacoes />} />
        <Route path="/classificar/:id" element={<Classificar />} />
        <Route path="/lancar" element={<EmBreve titulo="Lançar" />} />
        <Route path="/acertos" element={<Acertos />} />
        <Route path="/mais" element={<Mais />} />
      </Routes>
      <Ilha />
    </BrowserRouter>
  );
}
