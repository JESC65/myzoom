import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Client build only. The Worker (src/worker/index.ts) is bundled by Wrangler,
// which serves dist/client through Workers Static Assets (see wrangler.jsonc).
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
});
