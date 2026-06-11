import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on all interfaces (IPv4 + IPv6) so localhost/127.0.0.1 both work
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
