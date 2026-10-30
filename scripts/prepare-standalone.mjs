import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function prepareStandalone(projectRoot) {
  const standaloneDir = path.join(projectRoot, '.next', 'standalone')
  const staticDir = path.join(projectRoot, '.next', 'static')

  if (!existsSync(path.join(standaloneDir, 'server.js')) || !existsSync(staticDir)) {
    throw new Error('Production build not found. Run pnpm build before pnpm start.')
  }

  // Next.js standalone output deliberately excludes these assets. The server
  // serves them from its own directory, not from the repository root.
  mkdirSync(path.join(standaloneDir, '.next'), { recursive: true })
  cpSync(staticDir, path.join(standaloneDir, '.next', 'static'), { recursive: true })
  const publicDir = path.join(projectRoot, 'public')
  if (existsSync(publicDir)) {
    cpSync(publicDir, path.join(standaloneDir, 'public'), { recursive: true })
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  prepareStandalone(fileURLToPath(new URL('../', import.meta.url)))
  console.log('Standalone static and public assets are ready.')
}
