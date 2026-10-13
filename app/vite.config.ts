import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA: instalável no celular (tela cheia, ícone próprio). Guarda só o app em cache;
    // os dados vêm sempre do Supabase (precisa de internet).
    VitePWA({
      registerType: 'autoUpdate',   // deploy novo: o app se atualiza sozinho na próxima abertura
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Finance',
        short_name: 'Finance',
        description: 'Orçamento mês a mês',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#0E0D0C',
        theme_color: '#0E0D0C',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html' },
    }),
  ],
});
