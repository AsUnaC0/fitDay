import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // Capacitor 以 file:// 协议加载本地资源，必须使用相对路径
  base: './',
  build: {
    outDir: 'dist'
  }
})
