import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local (serve.mjs):        /dashboard/
// GitHub Pages project site: /SaccoFlow/dashboard/
const base = process.env.VITE_BASE_PATH || '/dashboard/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
