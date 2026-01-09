import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      build: {
        rollupOptions: {
          input: './src/client.tsx',
          output: {
            entryFileNames: 'static/client.js',
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-google': ['@google/genai'],
              'vendor-utils': ['docx', 'file-saver', 'html2canvas'],
              'supabase': ['@supabase/supabase-js']
            }
          }
        },
        outDir: 'dist',
        emptyOutDir: false,
        copyPublicDir: false,
        chunkSizeWarningLimit: 1000
      },
      plugins: [react()]
    }
  }
  
  return {
    plugins: [
      react(),
      devServer({
        adapter,
        entry: 'src/index.tsx'
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      ssr: 'src/index.tsx',
      rollupOptions: {
        output: {
          entryFileNames: '_worker.js'
        }
      }
    }
  }
})
