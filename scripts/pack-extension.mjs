#!/usr/bin/env node
/**
 * Build a Chrome Web Store zip from chrome-extension/ (after build:extension).
 * Usage: node scripts/pack-extension.mjs
 *
 * The zip has manifest.json at the root (required by the Chrome Web Store).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertVersionNotReleased,
  readManifestVersion,
} from './extension-version.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extDir = path.join(root, 'chrome-extension')
const version = readManifestVersion()
try {
  assertVersionNotReleased(version)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
const zipName = `close-stations-extension-${version}.zip`
const zipPath = path.join(root, zipName)
const stage = path.join(tmpdir(), `close-stations-ext-${version}-${process.pid}`)

const rootFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'popup.css',
]

rmSync(stage, { recursive: true, force: true })
mkdirSync(path.join(stage, 'icons'), { recursive: true })

for (const file of rootFiles) {
  copyFileSync(path.join(extDir, file), path.join(stage, file))
}
cpSync(path.join(extDir, 'icons'), path.join(stage, 'icons'), {
  recursive: true,
})

rmSync(zipPath, { force: true })
// Name files explicitly so entries are `manifest.json`, not `./manifest.json`
// or a nested folder — Chrome Web Store requires the manifest at zip root.
execFileSync('zip', ['-r', zipPath, ...rootFiles, 'icons'], {
  cwd: stage,
  stdio: 'inherit',
})
rmSync(stage, { recursive: true, force: true })

const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' })
if (!/^.*\smanifest\.json$/m.test(listing) && !listing.includes(' manifest.json\n')) {
  // unzip -l columns end with the path; accept a trailing path of manifest.json
  const hasRootManifest = listing
    .split('\n')
    .some((line) => /\smanifest\.json\s*$/.test(line) && !line.includes('/'))
  if (!hasRootManifest) {
    console.error(listing)
    throw new Error('Zip is missing manifest.json at the root')
  }
}

console.log(`Wrote ${zipName}`)
console.log('Upload this file to the Chrome Web Store (manifest is at zip root).')
