import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'convex/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src/services/__tests__/detectionService.integration.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});