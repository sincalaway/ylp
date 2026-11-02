// Builds a static Pagefind full-text index of every 医典阁 book into public/pagefind.
// Chapter pages render on demand, so instead of crawling HTML we feed Pagefind one small HTML
// document per chapter, built straight from the Markdown. Headings carry the same ids that
// rehype-slug gives them on the real page, so Pagefind's sub-results deep-link to the heading.
//
// Search text is folded traditional -> simplified with content/books/_t2s.json (the same table
// the site's title search uses); the search page folds the query the same way, so a query in
// either script matches. Run: node scripts/build-pagefind.mjs   (runs automatically before `next build`)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const booksDir = path.join(root, 'content', 'books')
const outDir = path.join(root, 'public', 'pagefind')

let t2s = {}
try { t2s = JSON.parse(fs.readFileSync(path.join(booksDir, '_t2s.json'), 'utf8')) } catch {}
const fold = (s) => { let o = ''; for (const ch of s) o += t2s[ch] ?? ch; return o }
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// plain text of one Markdown line (keeps the words, drops the markup)
const plain = (s) => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>~]|<[^>]+>/g, '').trim()

function toHtml({ title, bookTitle, author, category, body }) {
  const slugger = new GithubSlugger()
  const parts = []
  for (const line of body.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      const text = plain(m[2]); if (!text) continue
      const level = Math.min(Math.max(m[1].length, 2), 6)
      // id from the ORIGINAL heading text, exactly as rehype-slug does on the page
      parts.push(`<h${level} id="${esc(slugger.slug(text))}">${esc(fold(text))}</h${level}>`)
    } else {
      const text = plain(line); if (text) parts.push(`<p>${esc(fold(text))}</p>`)
    }
  }
  const metaTitle = fold(`《${bookTitle}》${title && title !== bookTitle ? ' · ' + title : ''}`)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(metaTitle)}</title></head><body>` +
    `<main data-pagefind-body><h1 data-pagefind-meta="title">${esc(metaTitle)}</h1>` +
    `<span data-pagefind-meta="book" hidden>${esc(fold(bookTitle))}</span>` +
    `<span data-pagefind-meta="author" hidden>${esc(fold(author))}</span>` +
    `<span data-pagefind-filter="category" hidden>${esc(category)}</span>` +
    parts.join('') + `</main></body></html>`
}

// Write one HTML file per chapter into a temp site, then run the Pagefind CLI over it
// (the Node API's writeFiles hangs on an index this large; the CLI reports errors properly).
const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ylp-pagefind-'))
// Pagefind keeps a whole index in memory while building; one index of all ~2,600万字 needs >6 GB.
// So books are split into shards of at most SHARD_CHARS characters, each built as its own index under
// public/pagefind/<n>/, and the search page merges them in the browser (pagefind.mergeIndex).
const SHARD_CHARS = Number(process.env.PF_SHARD_CHARS || 2_500_000)
const shardOf = new Map(); const shardSize = []
const shardFor = (bookSlug, size) => {
  if (shardOf.has(bookSlug)) return shardOf.get(bookSlug)
  let n = shardSize.length - 1
  if (n < 0 || shardSize[n] + size > SHARD_CHARS) { shardSize.push(0); n++ }
  shardSize[n] += size; shardOf.set(bookSlug, n); return n
}
const bookChars = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.md')).reduce((t, f) => t + fs.statSync(path.join(dir, f)).size / 3, 0)
const index = { async addHTMLFile({ url, content }) { const book = url.split('/')[2]; const full = path.join(booksDir, book); const n = shardFor(book, fs.existsSync(full) ? bookChars(full) : content.length); const f = path.join(siteDir, String(n), ...url.split('/').filter(Boolean)) + '.html'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); return {} } }

let pages = 0, chars = 0
for (const entry of fs.readdirSync(booksDir, { withFileTypes: true })) {
  const full = path.join(booksDir, entry.name)
  if (entry.isDirectory()) {
    const metaFile = path.join(full, 'meta.json'); if (!fs.existsSync(metaFile)) continue
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
    const list = Array.isArray(meta.chapters) && meta.chapters.length ? meta.chapters.map((c) => c.slug)
      : fs.readdirSync(full).filter((f) => f.endsWith('.md')).sort().map((f) => f.slice(0, -3))
    for (const slug of list) {
      const file = path.join(full, `${slug}.md`); if (!fs.existsSync(file)) continue
      const { data, content } = matter(fs.readFileSync(file, 'utf8'))
      const html = toHtml({ title: String(data.title || slug), bookTitle: String(meta.title || entry.name), author: `${meta.dynasty ? meta.dynasty + '·' : ''}${meta.author || ''}`, category: String(meta.category || '综合类'), body: content })
      const r = await index.addHTMLFile({ url: `/books/${entry.name}/${slug}`, content: html })
      if (r.errors?.length) console.warn(entry.name, slug, r.errors)
      pages++; chars += content.length
    }
  } else if (/\.mdx?$/i.test(entry.name)) {
    const slug = entry.name.replace(/\.mdx?$/i, '')
    const { data, content } = matter(fs.readFileSync(full, 'utf8'))
    const html = toHtml({ title: '', bookTitle: String(data.title || slug), author: `${data.dynasty ? data.dynasty + '·' : ''}${data.author || ''}`, category: String(data.category || '综合类'), body: content })
    await index.addHTMLFile({ url: `/books/${slug}`, content: html }); pages++; chars += content.length
  }
}

fs.rmSync(outDir, { recursive: true, force: true })
console.log(`Pagefind: ${pages} pages (${(chars / 1e4).toFixed(0)} 万字) in ${shardSize.length} shards, indexing…`)
if (process.env.PF_SITE_ONLY) { console.log(siteDir); process.exit(0) }
const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'pagefind.cmd' : 'pagefind')
for (let n = 0; n < shardSize.length; n++) {
  execFileSync(bin, ['--site', path.join(siteDir, String(n)), '--output-path', path.join(outDir, String(n)), '--force-language', 'zh-cn', '--quiet'], { stdio: 'inherit' })
  console.log(`  shard ${n + 1}/${shardSize.length} done`)
}
fs.writeFileSync(path.join(outDir, 'shards.json'), JSON.stringify({ shards: shardSize.map((_, n) => `/pagefind/${n}/`), pages, builtAt: new Date().toISOString() }))
fs.rmSync(siteDir, { recursive: true, force: true })
console.log('Pagefind index written to public/pagefind')
