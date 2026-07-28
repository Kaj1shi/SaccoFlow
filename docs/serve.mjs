// SaccoFlow local server — serves the marketing site and the React dashboard
// from ONE origin so login.html can hand its session to the dashboard.
//
//   1. Build the dashboard once:  cd dashboard && npm run build
//   2. Start the server:          node serve.mjs
//   3. Open:                      http://localhost:8080
//
// No dependencies required.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(ROOT, 'dashboard', 'dist')
const PORT = process.env.PORT || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function send(res, filePath, status = 200) {
  try {
    const body = await readFile(filePath)
    res.writeHead(status, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    res.end(body)
    return true
  } catch {
    return false
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  // Sanitize: collapse ".." so nobody can escape the project folder
  const pathname = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')

  // ── React dashboard under /dashboard ──────────────────────────────────────
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const rel = pathname.replace(/^\/dashboard\/?/, '')
    if (rel && (await send(res, join(DIST, rel)))) return
    // SPA fallback (client-side routes like /dashboard/members)
    if (await send(res, join(DIST, 'index.html'))) return
    res.writeHead(503, { 'Content-Type': 'text/plain' })
    res.end('Dashboard not built yet. Run: cd dashboard && npm run build')
    return
  }

  // ── Static marketing site ──────────────────────────────────────────────────
  const file = pathname === '/' ? 'index.html' : pathname.slice(1)
  if (await send(res, join(ROOT, file))) return
  if (!extname(file) && (await send(res, join(ROOT, `${file}.html`)))) return

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
}).listen(PORT, () => {
  console.log(`SaccoFlow running at http://localhost:${PORT}`)
  console.log(`  Site:      http://localhost:${PORT}/`)
  console.log(`  Login:     http://localhost:${PORT}/login.html`)
  console.log(`  Dashboard: http://localhost:${PORT}/dashboard/`)
})
