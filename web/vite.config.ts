import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:demo` gera um único HTML com back end simulado no navegador (sem API).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
  // Caminhos relativos: a demo funciona em qualquer pasta (ex.: GitHub Pages em /vizipet/).
  base: mode === 'demo' ? './' : '/',
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
}));
