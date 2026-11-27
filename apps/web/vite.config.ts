import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react(), {
    name: 'advisio-offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const shell = Object.keys(bundle).filter((name) => /\.(?:js|css|woff2?|ttf)$/.test(name)).map((name) => `/${name}`).sort();
      const entry = Object.values(bundle).find((item) => item.type === 'chunk' && item.isEntry);
      if (!entry) throw new Error('The offline shell needs the application entry point.');
      const revision = createHash('sha256').update(shell.join('\n')).digest('hex').slice(0, 16);
      const source = readFileSync(new URL('./offline-worker.js', import.meta.url), 'utf8')
        .replace('__ADVISIO_OFFLINE_SHELL__', JSON.stringify(shell))
        .replace('__ADVISIO_OFFLINE_ENTRY__', JSON.stringify(entry.fileName))
        .replace('__ADVISIO_OFFLINE_CACHE__', JSON.stringify(`advisio-shell-${revision}`));
      this.emitFile({ type: 'asset', fileName: 'advisio-sw.js', source });
    },
  }],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next/link': fileURLToPath(new URL('./src/lib/router-compat.tsx', import.meta.url)),
      'next/navigation': fileURLToPath(new URL('./src/lib/router-compat.tsx', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: process.env.ADVISIO_EVALUATION !== '1',
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || process.env.VITE_API_URL || 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || process.env.VITE_API_URL || 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
