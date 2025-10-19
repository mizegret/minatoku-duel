import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist-web' },
  server: {
    port: 5173,
    open: false,
    proxy: {
      // 開発時に Pages Functions を別ポート (8788) で動かす前提
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
});
