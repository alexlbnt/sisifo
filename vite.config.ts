/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { apiDevServer } from './vite.api-dev';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Vai junto nos relatórios de erro (Configurações → Erros recentes).
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    apiDevServer(),
    VitePWA({
      // O usuário decide quando atualizar (aviso "Nova versão disponível").
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'painel.webmanifest'],
      manifest: {
        id: '/',
        name: 'Sísifo',
        short_name: 'Sísifo',
        description: 'Painel pessoal de finanças, tarefas, metas, hábitos e treinos.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ebe7df',
        theme_color: '#ffffff',
        categories: ['productivity', 'finance', 'health'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Atalhos ao segurar o ícone na tela inicial.
        shortcuts: [
          {
            name: 'Captura rápida',
            short_name: 'Capturar',
            url: '/?captura=1',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Novo lançamento',
            short_name: 'Lançamento',
            url: '/finance/transactions?novo=1',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Nova tarefa',
            short_name: 'Tarefa',
            url: '/personal/tasks?nova=1',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'Check-in de hábitos',
            short_name: 'Hábitos',
            url: '/personal/habits',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // App shell completo em cache: abre sem internet (os dados já são locais).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // As telas de abertura do iPhone são lidas pelo sistema ao instalar; não precisam ir para o cache.
        globIgnores: ['splash/**'],
        navigateFallback: '/index.html',
        // A API nunca passa pelo cache: dados pessoais e sessão vão sempre à rede.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Recebe as notificações push e abre a tela certa ao tocar (public/push-sw.js).
        importScripts: ['/push-sw.js'],
      },
    }),
    {
      // O plugin do PWA põe o manifest do app em toda página; o painel tem o seu.
      name: 'sisifo-panel-manifest',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: (html, ctx) =>
          ctx.path.endsWith('/painel.html') ? html.replace(/<link rel="manifest" href="\/manifest\.webmanifest"[^>]*>/, '') : html,
      },
    },
  ],
  build: {
    rollupOptions: {
      // Modo Painel: entrada própria, com manifest em tela cheia e orientação livre (public/painel.webmanifest).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        painel: fileURLToPath(new URL('./painel.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
});
