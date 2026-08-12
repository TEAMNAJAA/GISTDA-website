import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The build inlines every asset into ONE dist/index.html so the simulator can be
// double-clicked with no server, no install and no internet — which is what the
// proposal requires for exhibition booths and classrooms.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  server: { port: 5173, open: true },
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
