import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: "./",
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './desktop/ui'),
    },
  },
  build: {
    outDir: "dist-react",
  },
  server: {
    port: 5123,
    strictPort: true,
  }
})
