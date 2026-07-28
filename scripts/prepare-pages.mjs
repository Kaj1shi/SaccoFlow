#!/usr/bin/env node
/**
 * Build a GitHub Pages–ready site into ./docs
 *
 *   node scripts/prepare-pages.mjs
 *
 * Then set GitHub → Settings → Pages → Source: Deploy from a branch
 * Branch: main, Folder: /docs
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const REPO = 'SaccoFlow'
const BASE = `/${REPO}/dashboard/`

console.log('Building dashboard for GitHub Pages at', BASE)

// Ensure Vite has env vars (CI may not have dashboard/.env)
const envFile = join(ROOT, 'dashboard', '.env')
const example = join(ROOT, 'dashboard', '.env.example')
if (!existsSync(envFile) && existsSync(example)) {
  cpSync(example, envFile)
  console.log('Created dashboard/.env from .env.example')
}

execSync('npm ci', { cwd: join(ROOT, 'dashboard'), stdio: 'inherit' })
execSync('npm run build', {
  cwd: join(ROOT, 'dashboard'),
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE_PATH: BASE },
})

if (existsSync(DOCS)) rmSync(DOCS, { recursive: true, force: true })
mkdirSync(DOCS, { recursive: true })

const staticFiles = [
  'index.html',
  'about.html',
  'pricing.html',
  'contact.html',
  'login.html',
  'register.html',
  'saccoflow.css',
  'serve.mjs',
]
for (const f of staticFiles) {
  const src = join(ROOT, f)
  if (existsSync(src)) cpSync(src, join(DOCS, f))
}

cpSync(join(ROOT, 'js'), join(DOCS, 'js'), { recursive: true })
cpSync(join(ROOT, 'dashboard', 'dist'), join(DOCS, 'dashboard'), { recursive: true })

// Tell GitHub Pages this is not a Jekyll site (underscored folders etc.)
writeFileSync(join(DOCS, '.nojekyll'), '')

console.log('\nDone. docs/ is ready.')
console.log('1. Commit and push docs/')
console.log('2. GitHub → Settings → Pages → Branch: main /docs')
console.log(`3. Open https://Kaj1shi.github.io/${REPO}/login.html`)
console.log('4. In Supabase → Auth → URL Configuration, add:')
console.log(`   Site URL: https://Kaj1shi.github.io/${REPO}/`)
console.log(`   Redirect: https://Kaj1shi.github.io/${REPO}/dashboard/reset-password`)
