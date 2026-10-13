import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { cliente } from './lib/cache';
import './styles/tema.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
