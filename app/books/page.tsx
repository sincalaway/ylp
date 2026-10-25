import Link from 'next/link'
import type { Metadata } from 'next'
import { getBooks } from '@/lib/content'
import { BookCard, PageHeading } from '@/components/content-cards'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '医典阁｜中医药古籍与书籍', description: '阅读中医药古籍选章与书籍资料，支持 Markdown 章节阅读与 PDF 在线预览。' }
const categories = ['全部','本草类','医经类','方书类','医案类','综合类','数字文献']
export default async function BooksPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
 const params=await searchParams;const category=params.category||'全部';const all=getBooks();const books=all.filter((b)=>category==='全部'||b.category===category)
 return <div className="container"><PageHeading eyebrow="CLASSICS LIBRARY · 医药典籍" title="医典阁" intro="在典籍之间循迹医道。收录古籍导读、选章与开放阅读资料，持续整理、审慎标注。"/><div className="toolbar"><div className="filter-list">{categories.map((c) => <Link key={c} className={`filter-chip ${category===c?'active':''}`} href={c==='全部'?'/books':`/books?category=${encodeURIComponent(c)}`}>{c}</Link>)}</div><span className="results-note" style={{margin:0}}>共 {books.length} 部典藏</span></div>{books.length ? <div className="book-grid">{books.map((book) => <BookCard key={book.slug} book={book}/>)}</div> : <div className="empty-state">该分类暂时没有书籍。</div>}<div className="notice-box" style={{marginTop:25}}><b>资料来源与版权：</b>本站示例内容用于传统文化阅读。上传与转载前请确认文本版本、来源和授权情况；古籍中涉及诊疗的内容不可直接用于自我诊断或治疗。</div></div>
}
