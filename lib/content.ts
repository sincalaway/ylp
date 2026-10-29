import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'

export type HerbIllustration = { src: string; title: string; source: string; sourceUrl: string; license: string; note?: string }
export type Herb = { illustration?: HerbIllustration; gangmuEntry?: string; slug: string; name: string; pinyin: string; category: string; nature: string; flavor: string; channels: string; effects: string; usage: string; cautions: string; description: string }
export type Article = { slug: string; title: string; category: string; date: string; excerpt: string; readTime: string; cover: string; content: string }
export type HomeConfig = { announcement: string; featuredHerbs: string[]; featuredBooks: string[]; featuredArticles: string[] }
const contentDir = path.join(process.cwd(), 'content')
const booksDir = path.join(contentDir, 'books')
function readJson<T>(file: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf8')) as T } catch { return fallback } }
export function getHerbs(): Herb[] { return readJson<Herb[]>('herbs.json', []) }
export function getArticles(): Article[] { return readJson<Article[]>('articles.json', []) }
export function getHomeConfig(): HomeConfig { return readJson<HomeConfig>('home.json', { announcement: '', featuredHerbs: [], featuredBooks: [], featuredArticles: [] }) }

export function getArticle(slug: string) { return getArticles().find((item) => item.slug === slug) }

// ------------------------------------------------------------------ books
// Two kinds of books live in content/books/:
//  * single files  (<slug>.md / .mdx / .pdf) — 导读 and admin uploads
//  * folder books  (<slug>/meta.json + NN-<chapter>.md) — complete classics imported from Wikisource
// Metadata is cached in module scope and invalidated by directory / meta.json mtimes, so uploads show up
// without a restart and large books are never re-read just to list them.

export type BookSource = { title: string; url: string; revid?: number }
export type BookChapter = { slug: string; title: string; chars: number; headings: string[] }
export type Book = { slug: string; title: string; author: string; dynasty: string; category: string; summary: string; coverLabel: string; featured: boolean; format: 'markdown' | 'pdf'; fileName: string; kind: 'file' | 'folder'; chapterCount: number; chars: number; sources: BookSource[]; license?: string }
export type ChapterResult = { book: Book; chapter: BookChapter; index: number; prev: BookChapter | null; next: BookChapter | null; content: string; source?: BookSource }

type FolderMeta = { title?: string; author?: string; dynasty?: string; category?: string; summary?: string; coverLabel?: string; featured?: boolean; sources?: BookSource[]; license?: string; chars?: number; chapters?: BookChapter[] }
type BookCache = { key: string; books: Book[]; chapters: Map<string, BookChapter[]> }
let bookCache: BookCache | null = null

const mtime = (p: string) => { try { return fs.statSync(p).mtimeMs } catch { return 0 } }
const isFolderBook = (dir: string) => fs.existsSync(path.join(dir, 'meta.json'))

function readFolderBook(slug: string): { book: Book; chapters: BookChapter[] } {
  const dir = path.join(booksDir, slug)
  let meta: FolderMeta = {}
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as FolderMeta } catch { meta = {} }
  let chapters = Array.isArray(meta.chapters) ? meta.chapters.filter((c) => c && typeof c.slug === 'string' && fs.existsSync(path.join(dir, `${c.slug}.md`))) : []
  if (!chapters.length) {
    // no chapter list in meta.json: fall back to scanning the folder (front matter title only)
    chapters = fs.readdirSync(dir).filter((f) => /\.md$/i.test(f)).sort().map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8'); const { data, content } = matter(raw)
      return { slug: f.replace(/\.md$/i, ''), title: String(data.title || f.replace(/\.md$/i, '')), chars: content.replace(/\s/g, '').length, headings: [] }
    })
  }
  chapters = chapters.map((c) => ({ slug: c.slug, title: String(c.title || c.slug), chars: Number(c.chars) || 0, headings: Array.isArray(c.headings) ? c.headings.map(String) : [] }))
  const book: Book = { slug, title: String(meta.title || slug), author: String(meta.author || '佚名'), dynasty: String(meta.dynasty || '未详'), category: String(meta.category || '综合类'), summary: String(meta.summary || '古籍全文'), coverLabel: String(meta.coverLabel || meta.title || '典籍珍藏'), featured: Boolean(meta.featured), format: 'markdown', fileName: slug, kind: 'folder', chapterCount: chapters.length, chars: Number(meta.chars) || chapters.reduce((n, c) => n + c.chars, 0), sources: Array.isArray(meta.sources) ? meta.sources : [], license: meta.license }
  return { book, chapters }
}

function loadBooks(): BookCache {
  if (!fs.existsSync(booksDir)) return { key: '', books: [], chapters: new Map() }
  const entries = fs.readdirSync(booksDir, { withFileTypes: true })
  const key = [mtime(booksDir), ...entries.map((e) => `${e.name}:${e.isDirectory() ? mtime(path.join(booksDir, e.name, 'meta.json')) : mtime(path.join(booksDir, e.name))}`)].join('|')
  if (bookCache && bookCache.key === key) return bookCache
  const books: Book[] = []; const chapters = new Map<string, BookChapter[]>()
  for (const entry of entries) {
    const full = path.join(booksDir, entry.name)
    if (entry.isDirectory()) {
      if (!/^[A-Za-z0-9_\u4e00-\u9fa5-]+$/.test(entry.name) || !isFolderBook(full)) continue
      const { book, chapters: list } = readFolderBook(entry.name); books.push(book); chapters.set(book.slug, list); continue
    }
    if (!/\.(md|mdx|pdf)$/i.test(entry.name)) continue
    const fileName = entry.name; const slug = fileName.replace(/\.(md|mdx|pdf)$/i, '')
    if (books.some((b) => b.slug === slug)) continue
    if (/\.pdf$/i.test(fileName)) { books.push({ slug, title: slug.replace(/[-_]/g, ' '), author: '资料整理', dynasty: '—', category: '数字文献', summary: '开放阅读资料。请留意原始版本与版权说明。', coverLabel: '数字典藏', featured: false, format: 'pdf', fileName, kind: 'file', chapterCount: 0, chars: 0, sources: [] }); continue }
    const raw = fs.readFileSync(full, 'utf8'); const { data, content } = matter(raw)
    books.push({ slug, title: String(data.title || slug), author: String(data.author || '佚名'), dynasty: String(data.dynasty || '未详'), category: String(data.category || '综合类'), summary: String(data.summary || '古籍阅读资料'), coverLabel: String(data.coverLabel || '典籍珍藏'), featured: Boolean(data.featured), format: 'markdown', fileName, kind: 'file', chapterCount: 0, chars: content.replace(/\s/g, '').length, sources: [] })
  }
  books.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title, 'zh-CN'))
  bookCache = { key, books, chapters }; gangmuIndex = null; searchIndex = null
  return bookCache
}

export function getBooks(): Book[] { return loadBooks().books }
export function getBookChapters(slug: string): BookChapter[] { return loadBooks().chapters.get(slug) || [] }
/** Single-file books return their markdown in `content`; folder books return '' plus their chapter list. */
export function getBook(slug: string): { book: Book; content: string; chapters: BookChapter[] } | null {
  const book = getBooks().find((item) => item.slug === slug)
  if (!book) return null
  if (book.kind === 'folder') return { book, content: '', chapters: getBookChapters(slug) }
  if (book.format === 'pdf') return { book, content: '', chapters: [] }
  const { content } = matter(fs.readFileSync(path.join(booksDir, book.fileName), 'utf8'))
  return { book, content, chapters: [] }
}
export function getBookChapter(slug: string, chapterSlug: string): ChapterResult | null {
  const book = getBooks().find((item) => item.slug === slug && item.kind === 'folder')
  if (!book) return null
  const list = getBookChapters(slug); const index = list.findIndex((c) => c.slug === chapterSlug)
  if (index < 0) return null
  const file = path.join(booksDir, slug, `${chapterSlug}.md`)
  let parsed: { data: Record<string, unknown>; content: string }
  try { parsed = matter(fs.readFileSync(file, 'utf8')) } catch { return null }
  const { data, content } = parsed
  const source = data.source ? { title: String(data.source), url: String(data.sourceUrl || ''), revid: data.revid ? Number(data.revid) : undefined } : undefined
  return { book, chapter: list[index], index, prev: list[index - 1] || null, next: list[index + 1] || null, content, source }
}
export function getBookCategories() { return Array.from(new Set(getBooks().map((b) => b.category))) }

// ------------------------------------------------------------------ 本草纲目 entry links
export const GANGMU_SLUG = 'ben-cao-gang-mu-yuanwen'
let gangmuIndex: Map<string, string> | null = null
const normEntry = (s: string) => s.normalize('NFKC').replace(/[\s（）()【】〔〕［］\[\]、·・]/g, '')
/**
 * Link to an entry of the full 本草綱目: finds the chapter whose markdown has the heading `## <name>` (or ###)
 * and returns `/books/ben-cao-gang-mu-yuanwen/<chapter>#<github-slugger id>`, or null when no such entry.
 * Matching ignores spaces and brackets, so 「枸杞（地骨皮）」 finds the heading 「枸杞地骨皮」.
 */
export function getGangmuEntryHref(name: string): string | null {
  if (!name) return null
  if (!gangmuIndex) {
    const index = new Map<string, string>()
    for (const chapter of getBookChapters(GANGMU_SLUG)) {
      let content = ''
      try { content = matter(fs.readFileSync(path.join(booksDir, GANGMU_SLUG, `${chapter.slug}.md`), 'utf8')).content } catch { continue }
      const slugger = new GithubSlugger()
      for (const line of content.split('\n')) {
        const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
        if (!m) continue
        const title = m[2]; const id = slugger.slug(title)
        if (m[1].length > 3) continue
        const key = normEntry(title)
        if (!index.has(key)) index.set(key, `/books/${GANGMU_SLUG}/${chapter.slug}#${encodeURIComponent(id)}`)
      }
    }
    gangmuIndex = index
  }
  return gangmuIndex.get(normEntry(name)) || null
}

// ------------------------------------------------------------------ search
// Index of book titles/authors/summaries and chapter titles + headings, built once per content change.
// Full text of the large classics is deliberately not scanned per request.
export type ChapterHit = { book: Book; chapter: BookChapter; heading?: string }
// traditional -> simplified folding for search (content/books/_t2s.json is written by scripts/import-wikisource.py)
let t2s: Record<string, string> | null = null
function fold(text: string) {
  if (!t2s) { try { t2s = JSON.parse(fs.readFileSync(path.join(booksDir, '_t2s.json'), 'utf8')) as Record<string, string> } catch { t2s = {} } }
  const map = t2s; let out = ''
  for (const ch of text.toLocaleLowerCase()) out += map[ch] || ch
  return out
}
let searchIndex: { books: { book: Book; text: string }[]; chapters: { book: Book; chapter: BookChapter; text: string }[] } | null = null
function getSearchIndex() {
  loadBooks()
  if (searchIndex) return searchIndex
  const books = getBooks().map((book) => {
    let extra = ''
    if (book.kind === 'file' && book.format === 'markdown') { try { extra = matter(fs.readFileSync(path.join(booksDir, book.fileName), 'utf8')).content.slice(0, 200_000) } catch { extra = '' } }
    return { book, text: fold([book.title, book.author, book.category, book.dynasty, book.summary, book.coverLabel, ...book.sources.map((s) => s.title), extra].join(' ')) }
  })
  const chapters = getBooks().flatMap((book) => getBookChapters(book.slug).map((chapter) => ({ book, chapter, text: fold([chapter.title, ...chapter.headings].join('\n')) })))
  searchIndex = { books, chapters }
  return searchIndex
}
export function searchContent(query: string) {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return { herbs: [] as Herb[], books: [] as Book[], chapters: [] as ChapterHit[], articles: [] as Article[] }
  const herbs = getHerbs(); const articles = getArticles(); const index = getSearchIndex(); const fq = fold(q)
  const chapters: ChapterHit[] = []
  for (const item of index.chapters) {
    if (!item.text.includes(fq)) continue
    const heading = fold(item.chapter.title).includes(fq) ? undefined : item.chapter.headings.find((h) => fold(h).includes(fq))
    chapters.push({ book: item.book, chapter: item.chapter, heading })
    if (chapters.length >= 60) break
  }
  return {
    herbs: herbs.filter((h) => [h.name, h.pinyin, h.category, h.effects, h.description].join(' ').toLocaleLowerCase().includes(q)),
    books: index.books.filter((b) => b.text.includes(fq)).map((b) => b.book),
    chapters,
    articles: articles.filter((a) => [a.title, a.category, a.excerpt, a.content].join(' ').toLocaleLowerCase().includes(q))
  }
}
