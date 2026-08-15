#!/usr/bin/env node
/**
 * Chrome extension version helpers.
 *
 *   node scripts/extension-version.mjs bump --base <sha>
 *     Fail if extension payload files changed vs <sha> but manifest version
 *     did not increase.
 *
 *   node scripts/extension-version.mjs released [--tag extension-vX.Y.Z]
 *     Fail if this version was already released (git tag on another commit,
 *     or an unexpired GitHub Actions artifact). When packing the tagged
 *     commit itself, the matching tag is allowed (rebuilds).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'chrome-extension', 'manifest.json')
const TAG_PREFIX = 'extension-v'
const ARTIFACT_PREFIX = 'close-stations-extension-'

export function readManifestVersion(source = readFileSync(manifestPath, 'utf8')) {
  const version = JSON.parse(source).version
  parseChromeVersion(version)
  return version
}

/** Chrome Web Store: 1–4 integers, each 0–65535. */
export function parseChromeVersion(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/.test(version)) {
    throw new Error(`Invalid Chrome extension version: ${JSON.stringify(version)}`)
  }
  const parts = version.split('.').map(Number)
  if (parts.some((n) => n > 65535)) {
    throw new Error(`Chrome extension version component exceeds 65535: ${version}`)
  }
  while (parts.length < 4) parts.push(0)
  return parts
}

export function compareChromeVersions(a, b) {
  const pa = parseChromeVersion(a)
  const pb = parseChromeVersion(b)
  for (let i = 0; i < 4; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

export function isExtensionPayloadPath(file) {
  if (file.startsWith('shared/tfl/')) return true
  if (file === 'vite.extension.config.ts') return true
  if (!file.startsWith('chrome-extension/')) return false
  if (file.endsWith('.md') || file.endsWith('.map')) return false
  return true
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function gitOrNull(args) {
  try {
    return git(args)
  } catch {
    return null
  }
}

function headCommit() {
  return git(['rev-parse', 'HEAD'])
}

function isMissingSha(sha) {
  return !sha || /^0+$/.test(sha)
}

function commitExists(sha) {
  return gitOrNull(['cat-file', '-e', `${sha}^{commit}`]) !== null
}

export function listExtensionTags() {
  const names = gitOrNull(['tag', '-l', `${TAG_PREFIX}*`])
  if (!names) return []
  const tags = []
  for (const name of names.split('\n').filter(Boolean)) {
    const version = name.slice(TAG_PREFIX.length)
    try {
      parseChromeVersion(version)
    } catch {
      continue
    }
    const commit = gitOrNull(['rev-parse', `${name}^{commit}`])
    if (!commit) continue
    tags.push({ name, version, commit })
  }
  return tags
}

function parseGithubRepo(remote) {
  const ssh = remote.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
  if (ssh) return `${ssh[1]}/${ssh[2]}`
  const https = remote.match(/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (https) return `${https[1]}/${https[2]}`
  return null
}

function listUnexpiredArtifacts(version) {
  const remote = gitOrNull(['remote', 'get-url', 'origin'])
  if (!remote) return { ok: false, ids: [] }
  const repo = parseGithubRepo(remote)
  if (!repo) return { ok: false, ids: [] }

  const name = `${ARTIFACT_PREFIX}${version}`
  try {
    const out = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/actions/artifacts?per_page=100`,
        '--jq',
        `.artifacts[] | select(.name == "${name}" and .expired == false) | .id`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim()
    return { ok: true, ids: out ? out.split('\n').filter(Boolean) : [] }
  } catch {
    return { ok: false, ids: [] }
  }
}

export function assertVersionBumped(base) {
  if (isMissingSha(base)) {
    console.log('No base commit; skipping extension version bump check.')
    return
  }
  if (!commitExists(base)) {
    throw new Error(`Base commit ${base} is not available. Fetch the target branch first.`)
  }

  const changed = git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .filter(Boolean)
  const payloadChanges = changed.filter(isExtensionPayloadPath)
  if (payloadChanges.length === 0) {
    console.log('No extension payload changes; version bump not required.')
    return
  }

  const newVersion = readManifestVersion()
  const oldSource = gitOrNull(['show', `${base}:chrome-extension/manifest.json`])
  if (!oldSource) {
    console.log(`Extension added at ${newVersion}; version bump check passed.`)
    return
  }
  const oldVersion = readManifestVersion(oldSource)

  if (compareChromeVersions(newVersion, oldVersion) <= 0) {
    const files = payloadChanges.map((f) => `  ${f}`).join('\n')
    throw new Error(
      `Extension files changed but chrome-extension/manifest.json version did not increase (${oldVersion} → ${newVersion}).\n` +
        `Bump "version" in chrome-extension/manifest.json (Chrome Web Store rejects reused versions).\n` +
        `Changed:\n${files}`,
    )
  }

  console.log(`Extension version bumped ${oldVersion} → ${newVersion}.`)
}

export function assertVersionNotReleased(version, { tagName = '' } = {}) {
  parseChromeVersion(version)

  if (tagName) {
    const expected = `${TAG_PREFIX}${version}`
    if (tagName !== expected) {
      throw new Error(
        `Git tag ${tagName} does not match manifest version ${version} (expected ${expected}).`,
      )
    }
  }

  const head = headCommit()
  const tags = listExtensionTags()
  const matching = tags.filter((t) => compareChromeVersions(t.version, version) === 0)
  const foreignMatch = matching.find((t) => t.commit !== head)
  if (foreignMatch) {
    throw new Error(
      `Version ${version} already released as ${foreignMatch.name} on ${foreignMatch.commit.slice(0, 7)}. ` +
        `Bump chrome-extension/manifest.json before packing.`,
    )
  }

  const others = tags.filter((t) => t.commit !== head)
  if (others.length > 0) {
    const latest = others.reduce((a, b) =>
      compareChromeVersions(a.version, b.version) >= 0 ? a : b,
    )
    if (compareChromeVersions(version, latest.version) <= 0) {
      throw new Error(
        `Version ${version} is not greater than already released ${latest.version} (${latest.name}). ` +
          `Bump chrome-extension/manifest.json before packing.`,
      )
    }
  }

  const onReleaseCommit = matching.some((t) => t.commit === head)
  const artifacts = listUnexpiredArtifacts(version)
  if (artifacts.ok && artifacts.ids.length > 0 && !onReleaseCommit) {
    throw new Error(
      `Version ${version} already has a GitHub Actions artifact (${ARTIFACT_PREFIX}${version}). ` +
        `Bump chrome-extension/manifest.json, or pack from the ${TAG_PREFIX}${version} tag to rebuild.`,
    )
  }
  if (!artifacts.ok) {
    console.log('Could not query GitHub artifacts (gh missing or unauthenticated); skipped artifact check.')
  }

  console.log(`Extension version ${version} is unique.`)
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const flags = {}
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--base') flags.base = rest[++i]
    else if (rest[i] === '--tag') flags.tag = rest[++i]
    else throw new Error(`Unknown argument: ${rest[i]}`)
  }
  return { cmd, flags }
}

function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2))
  if (cmd === 'bump') {
    if (!flags.base) throw new Error('usage: node scripts/extension-version.mjs bump --base <sha>')
    assertVersionBumped(flags.base)
    return
  }
  if (cmd === 'released') {
    assertVersionNotReleased(readManifestVersion(), { tagName: flags.tag ?? '' })
    return
  }
  throw new Error('usage: node scripts/extension-version.mjs <bump --base <sha>|released [--tag <name>]>')
}

const invoked = process.argv[1] && path.resolve(process.argv[1])
if (invoked === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
