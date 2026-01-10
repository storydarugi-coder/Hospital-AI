import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { resolve } from 'path'

// 클라이언트 전용 빌드 (SSR/Worker 제거)
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-google': ['@google/genai'],
          'vendor-utils': ['docx', 'file-saver', 'html2canvas'],
          'supabase': ['@supabase/supabase-js']
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    chunkSizeWarningLimit: 1000
  },
  plugins: [
    react(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
