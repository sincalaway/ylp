import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareStandalone } from './prepare-standalone.mjs'

function fixture(t, { publicAssets = true } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'herbal-standalone-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const dir of ['.next/standalone/content', '.next/static/chunks']) {
    mkdirSync(path.join(root, dir), { recursive: true })
  }
  writeFileSync(path.join(root, '.next/standalone/server.js'), '// server')
  writeFileSync(path.join(root, '.next/standalone/content/upload.md'), 'keep existing content')
  writeFileSync(path.join(root, '.next/static/chunks/site.css'), 'body{color:green}')
  if (publicAssets) {
    mkdirSync(path.join(root, 'public/images'), { recursive: true })
    writeFileSync(path.join(root, 'public/images/logo.svg'), '<svg/>')
  }
  return root
}

test('copies CSS and public images beside the standalone server', (t) => {
  const root = fixture(t)
  prepareStandalone(root)
  assert.equal(readFileSync(path.join(root, '.next/standalone/.next/static/chunks/site.css'), 'utf8'), 'body{color:green}')
  assert.equal(readFileSync(path.join(root, '.next/standalone/public/images/logo.svg'), 'utf8'), '<svg/>')
  assert.equal(readFileSync(path.join(root, '.next/standalone/content/upload.md'), 'utf8'), 'keep existing content')
})

test('repeated preparation updates assets without nesting their directories', (t) => {
  const root = fixture(t)
  prepareStandalone(root)
  writeFileSync(path.join(root, '.next/static/chunks/site.css'), 'body{color:red}')
  prepareStandalone(root)
  assert.equal(readFileSync(path.join(root, '.next/standalone/.next/static/chunks/site.css'), 'utf8'), 'body{color:red}')
})

test('supports a build without an optional public directory', (t) => {
  const root = fixture(t, { publicAssets: false })
  assert.doesNotThrow(() => prepareStandalone(root))
})

test('reports a missing production build before starting the server', (t) => {
  const root = fixture(t)
  rmSync(path.join(root, '.next/standalone/server.js'))
  assert.throws(() => prepareStandalone(root), /Run pnpm build/)
})
