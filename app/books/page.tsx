import Link from 'next/link'
import type { Metadata } from 'next'
import { getBooks } from '@/lib/content'
import { BookCard, PageHeading } from '@/components/content-cards'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '医典阁｜中医药古籍与书籍', description: '在线阅读《黄帝内经》《本草纲目》《伤寒论》等五十部中医古籍全本与导读，按卷分篇，支持目录与阅读进度。' }
const ORDER = ['医经类','本草类','伤寒金匮类','方书类','温病类','诊法类','针灸类','临证各科类','医论类','养生类','医案类','综合类','数字文献']
export default async function BooksPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
 const params=await searchParams;const category=params.category||'全部';const all=getBooks();const present=Array.from(new Set(all.map((b)=>b.category)));const categories=['全部',...ORDER.filter((c)=>present.includes(c)),...present.filter((c)=>!ORDER.includes(c))];const fullCount=all.filter((b)=>b.kind==='folder').length;const books=all.filter((b)=>category==='全部'||b.category===category)
 return <div className="container"><PageHeading eyebrow="CLASSICS LIBRARY · 医药典籍" title="医典阁" intro={`在典籍之间循迹医道。收录 ${fullCount} 部中医古籍全本（维基文库公有领域原文）与古籍导读，持续整理、审慎标注。`}/><div className="toolbar"><div className="filter-list">{categories.map((c) => <Link key={c} className={`filter-chip ${category===c?'active':''}`} href={c==='全部'?'/books':`/books?category=${encodeURIComponent(c)}`}>{c}</Link>)}</div><span className="results-note" style={{margin:0}}>共 {books.length} 部典藏</span></div>{books.length ? <div className="book-grid">{books.map((book) => <BookCard key={book.slug} book={book}/>)}</div> : <div className="empty-state">该分类暂时没有书籍。</div>}<div className="notice-box" style={{marginTop:25}}><b>资料来源与版权：</b>古籍全本取自维基文库（zh.wikisource.org），属公有领域（PD-old），各书目录页列有来源页面与修订版本。上传与转载前请确认文本版本、来源和授权情况；古籍中涉及诊疗的内容不可直接用于自我诊断或治疗。</div></div>
}
