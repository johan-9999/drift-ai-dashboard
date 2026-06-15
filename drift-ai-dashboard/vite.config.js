import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://johan-9999.github.io/drift-ai-dashboard/ in production,
  // but from the root path during local `npm run dev`.
  base: command === 'build' ? '/drift-ai-dashboard/' : '/',
  plugins: [react()],
  server: {
    host: true, // listen on all interfaces (IPv4 + IPv6) so localhost/127.0.0.1 both work
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
}))
