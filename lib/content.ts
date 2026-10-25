import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export type Herb = { slug: string; name: string; pinyin: string; category: string; nature: string; flavor: string; channels: string; effects: string; usage: string; cautions: string; description: string }
export type Article = { slug: string; title: string; category: string; date: string; excerpt: string; readTime: string; cover: string; content: string }
export type HomeConfig = { announcement: string; featuredHerbs: string[]; featuredBooks: string[]; featuredArticles: string[] }
export type Book = { slug: string; title: string; author: string; dynasty: string; category: string; summary: string; coverLabel: string; featured: boolean; format: 'markdown' | 'pdf'; fileName: string }
const contentDir = path.join(process.cwd(), 'content')
const booksDir = path.join(contentDir, 'books')
function readJson<T>(file: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf8')) as T } catch { return fallback } }
export function getHerbs(): Herb[] { return readJson<Herb[]>('herbs.json', []) }
export function getArticles(): Article[] { return readJson<Article[]>('articles.json', []) }
export function getHomeConfig(): HomeConfig { return readJson<HomeConfig>('home.json', { announcement: '', featuredHerbs: [], featuredBooks: [], featuredArticles: [] }) }

export function getBooks(): Book[] {
  if (!fs.existsSync(booksDir)) return []
  const files = fs.readdirSync(booksDir).filter((f) => /\.(md|mdx|pdf)$/i.test(f))
  return files.map((fileName): Book => {
    const slug = fileName.replace(/\.(md|mdx|pdf)$/i, '')
    if (/\.pdf$/i.test(fileName)) return { slug, title: slug.replace(/[-_]/g, ' '), author: '资料整理', dynasty: '—', category: '数字文献', summary: '开放阅读资料。请留意原始版本与版权说明。', coverLabel: '数字典藏', featured: false, format: 'pdf', fileName }
    const raw = fs.readFileSync(path.join(booksDir, fileName), 'utf8')
    const { data } = matter(raw)
    return { slug, title: String(data.title || slug), author: String(data.author || '佚名'), dynasty: String(data.dynasty || '未详'), category: String(data.category || '综合类'), summary: String(data.summary || '古籍阅读资料'), coverLabel: String(data.coverLabel || '典籍珍藏'), featured: Boolean(data.featured), format: 'markdown', fileName }
  }).sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title, 'zh-CN'))
}
export function getBook(slug: string) {
  const book = getBooks().find((item) => item.slug === slug)
  if (!book) return null
  if (book.format === 'pdf') return { book, content: '' }
  const filePath = path.join(booksDir, book.fileName)
  const { content } = matter(fs.readFileSync(filePath, 'utf8'))
  return { book, content }
}
export function getArticle(slug: string) { return getArticles().find((item) => item.slug === slug) }
export function searchContent(query: string) {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return { herbs: [] as Herb[], books: [] as Book[], articles: [] as Article[] }
  const herbs = getHerbs(); const articles = getArticles()
  return {
    herbs: herbs.filter((h) => [h.name, h.pinyin, h.category, h.effects, h.description].join(' ').toLocaleLowerCase().includes(q)),
    books: getBooks().filter((b) => [b.title, b.author, b.category, b.summary, b.format === 'markdown' ? getBook(b.slug)?.content || '' : ''].join(' ').toLocaleLowerCase().includes(q)),
    articles: articles.filter((a) => [a.title, a.category, a.excerpt, a.content].join(' ').toLocaleLowerCase().includes(q))
  }
}
export function getBookCategories() { return Array.from(new Set(getBooks().map((b) => b.category))) }
