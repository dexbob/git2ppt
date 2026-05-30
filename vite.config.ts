import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'lib'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 애니메이션 라이브러리는 무겁고 독립적이므로 개별 분할
            if (id.includes('framer-motion') || id.includes('popmotion')) {
              return 'motion-bundle';
            }
            // 그 외 공통 라이브러리 통합 (React, lucide-react, react-markdown 등)
            return 'vendor';
          }
        },
      },
    },
  },
});
