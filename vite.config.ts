import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    // v0.2.2：监听所有网卡，允许同一局域网下其他设备通过 IP:端口 访问
    // `true` 等同于 0.0.0.0，Vite 启动时会额外打印 Network: http://<LAN-IP>:5173
    host: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@components': resolve(__dirname, 'src/components'),
      '@levels': resolve(__dirname, 'src/levels'),
      '@hooks': resolve(__dirname, 'src/hooks'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
} as any);
