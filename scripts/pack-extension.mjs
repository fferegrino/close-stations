#!/usr/bin/env node
/**
 * Build a Chrome Web Store zip from chrome-extension/ (after build:extension).
 * Usage: node scripts/pack-extension.mjs
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extDir = path.join(root, 'chrome-extension')
const manifest = JSON.parse(
  readFileSync(path.join(extDir, 'manifest.json'), 'utf8'),
)
const version = manifest.version
const zipName = `close-stations-extension-${version}.zip`
const zipPath = path.join(root, zipName)
const stage = path.join(tmpdir(), `close-stations-ext-${version}-${process.pid}`)

rmSync(stage, { recursive: true, force: true })
mkdirSync(path.join(stage, 'icons'), { recursive: true })

for (const file of [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'popup.css',
]) {
  copyFileSync(path.join(extDir, file), path.join(stage, file))
}
cpSync(path.join(extDir, 'icons'), path.join(stage, 'icons'), {
  recursive: true,
})

rmSync(zipPath, { force: true })
execFileSync('zip', ['-r', zipPath, '.'], { cwd: stage, stdio: 'inherit' })
rmSync(stage, { recursive: true, force: true })

console.log(`Wrote ${zipName}`)
