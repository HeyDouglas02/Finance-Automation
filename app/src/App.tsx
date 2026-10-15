import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useSessao } from './hooks/useSessao';
import { OcultoContexto, gravarOculto, lerOculto } from './hooks/useOculto';
import { definirOculto } from './lib/formato';
import { Ilha } from './components/Ilha';
import { PuxarParaAtualizar } from './components/PuxarParaAtualizar';
import { Login } from './pages/Login';
import { Mes } from './pages/Mes';
import { Meses } from './pages/Meses';
import { Transacoes } from './pages/Transacoes';
import { Classificar } from './pages/Classificar';
import { Acertos } from './pages/Acertos';
import { Mais } from './pages/Mais';
import { Lancar } from './pages/Lancar';
import { EditarLancamento } from './pages/EditarLancamento';

export function App() {
  const sessao = useSessao();
  const [oculto, setOculto] = useState(lerOculto);
  definirOculto(oculto);   // antes das telas renderizarem: reais() já sai com "•••"
  const alternar = () => { gravarOculto(!oculto); setOculto(!oculto); };

  if (sessao === undefined) return null;   // verificando o login
  if (sessao === null) return <Login />;    // deslogado

  return (
    <OcultoContexto.Provider value={{ oculto, alternar }}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Mes />} />
        <Route path="/meses" element={<Meses />} />
        <Route path="/transacoes" element={<Transacoes />} />
        <Route path="/classificar/:id" element={<Classificar />} />
        <Route path="/lancar" element={<Lancar />} />
        <Route path="/lancamento/:tipo/:id" element={<EditarLancamento />} />
        <Route path="/acertos" element={<Acertos />} />
        <Route path="/mais" element={<Mais />} />
      </Routes>
      <Ilha />
      <PuxarParaAtualizar />
    </BrowserRouter>
    </OcultoContexto.Provider>
  );
}
