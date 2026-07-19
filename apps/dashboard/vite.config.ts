import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env['GITHUB_ACTIONS'] ? '/home-configurator/' : '/',
  server: { port: 4173 },
  preview: { port: 4173 },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
