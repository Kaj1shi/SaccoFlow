import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Served under /dashboard/ on the same origin as the marketing site,
  // so the session stored by login.html is visible to the app.
  base: '/dashboard/',
  plugins: [react(), tailwindcss()],
})
