import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// ──────────────────────────────────────────────────────────────────────────
// RED (Wave 0, PWA-01 / SC-5 / D-06,D-08): static asserts over the PWA source
// assets. The load-bearing SC-5 proof — `public/sw.js` contains ZERO `fetch`
// listeners (the offline-caching anti-feature is forbidden: a cache-first SW
// breaks realtime on stale-asset deploys). Plus the `public/manifest.webmanifest`
// shape (installability). These assets do NOT exist yet in Wave 0, so reading
// them throws ENOENT — RED fails on the absent `public/` SOURCE files, NOT on a
// missing build output. The `dist/` icon-presence asserts are the per-wave-merge
// gate and are skipped until the feature's own build artifact (`dist/sw.js`)
// exists, so Wave 0 never fails spuriously on a stale or absent `dist/`.
// ──────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const SW_SOURCE = path.join(ROOT, 'public', 'sw.js')
const MANIFEST_SOURCE = path.join(ROOT, 'public', 'manifest.webmanifest')

// Matches every fetch-listener form: addEventListener('fetch' / "fetch" with any
// surrounding whitespace, self.onfetch, and `.onfetch =` assignment.
const FETCH_LISTENER_RE =
  /addEventListener\(\s*['"]fetch['"]|self\.onfetch|\.onfetch\s*=/

interface ManifestIcon {
  src?: string
  sizes?: string
  type?: string
  purpose?: string
}
interface Manifest {
  name?: string
  start_url?: string
  scope?: string
  display?: string
  icons?: ManifestIcon[]
  prefer_related_applications?: boolean
}

describe('public/sw.js — SC-5 no fetch handler (the offline-caching anti-feature proof)', () => {
  it('exists as a source file in public/', () => {
    expect(fs.existsSync(SW_SOURCE)).toBe(true)
  })

  it('contains ZERO fetch listeners (no addEventListener("fetch"), no self.onfetch, no .onfetch =)', () => {
    const text = fs.readFileSync(SW_SOURCE, 'utf8')
    expect(FETCH_LISTENER_RE.test(text)).toBe(false)
  })
})

describe('public/manifest.webmanifest — installability shape (PWA-01 / D-08)', () => {
  function readManifest(): Manifest {
    return JSON.parse(fs.readFileSync(MANIFEST_SOURCE, 'utf8')) as Manifest
  }

  it('exists and parses as JSON', () => {
    expect(fs.existsSync(MANIFEST_SOURCE)).toBe(true)
    expect(() => readManifest()).not.toThrow()
  })

  it('declares name, start_url, and scope', () => {
    const m = readManifest()
    expect(typeof m.name).toBe('string')
    expect((m.name ?? '').length).toBeGreaterThan(0)
    expect(typeof m.start_url).toBe('string')
    expect(typeof m.scope).toBe('string')
  })

  it('sets display to "standalone" (SC-4 chrome-free launch)', () => {
    expect(readManifest().display).toBe('standalone')
  })

  it('includes at least one 192x192 and one 512x512 icon', () => {
    const icons = readManifest().icons ?? []
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true)
    expect(icons.some((i) => i.sizes === '512x512')).toBe(true)
  })

  it('does NOT set prefer_related_applications: true (would block installability)', () => {
    expect(readManifest().prefer_related_applications).not.toBe(true)
  })
})

// Build-output gate (per-wave-merge): icons must ship in dist/ after `npm run
// build`. Skipped until the feature's OWN build artifact (dist/sw.js) exists so
// Wave 0 RED never trips on a stale or absent dist/ — the RED reason stays the
// missing public/ source files above.
const DIST_SW = path.join(ROOT, 'dist', 'sw.js')

describe.skipIf(!fs.existsSync(DIST_SW))(
  'dist/ build output — icons present (SC-4 / PWA-01 icon presence)',
  () => {
    it('dist/icon-192.png exists', () => {
      expect(fs.existsSync(path.join(ROOT, 'dist', 'icon-192.png'))).toBe(true)
    })
    it('dist/icon-512.png exists', () => {
      expect(fs.existsSync(path.join(ROOT, 'dist', 'icon-512.png'))).toBe(true)
    })
    it('dist/icon-512-maskable.png exists', () => {
      expect(fs.existsSync(path.join(ROOT, 'dist', 'icon-512-maskable.png'))).toBe(true)
    })
    it('dist/sw.js is also fetch-handler-free', () => {
      const text = fs.readFileSync(DIST_SW, 'utf8')
      expect(FETCH_LISTENER_RE.test(text)).toBe(false)
    })
  },
)
