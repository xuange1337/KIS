import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // В разработке клиент и API запускаются раздельно; в production
    // этот же путь /api проксирует nginx (см. web/nginx.conf)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Ядро React и библиотеки данных меняются реже самого приложения:
        // в отдельных чанках они кэшируются между релизами, а точка входа
        // не раздувается по мере роста интерфейса
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (
            /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(
              id,
            )
          )
            return 'vendor-react';
          if (/node_modules\/(@tanstack|axios)\//.test(id))
            return 'vendor-data';
          return undefined;
        },
      },
    },
  },
});
