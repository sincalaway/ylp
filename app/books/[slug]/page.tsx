import Link from 'next/link'
import GithubSlugger from 'github-slugger'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getBook, getBooks } from '@/lib/content'
import { MarkdownReader, ReadingTracker } from '@/components/reading-tools'
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const {slug}=await params;const item=getBook(slug);return{title:item?`${item.book.title}｜医典阁`:'典籍阅读',description:item?.book.summary} }
export default async function BookReadPage({ params }: { params: Promise<{ slug: string }> }) {
 const {slug}=await params;const result=getBook(slug);if(!result)notFound();const {book,content}=result
 const slugger=new GithubSlugger();const headings=content.split('\n').flatMap((line)=>{const match=line.match(/^(#{1,4})\s+(.+)$/);if(!match)return[];const title=match[2].trim();return[{depth:match[1].length,title,id:slugger.slug(title)}]})
 return <div className="detail-layout"><div className="detail-top"><span className="eyebrow">READING ROOM · 古籍阅读</span><h1>{book.title}</h1><p className="detail-sub">{book.dynasty}　·　{book.author}　·　{book.category}</p><p className="detail-sub" style={{marginTop:10}}>{book.summary}</p></div><ReadingTracker slug={book.slug}/>{book.format==='pdf'?<iframe title={`《${book.title}》PDF预览`} className="pdf-frame" src={`/api/books/pdf/${encodeURIComponent(book.slug)}`}/>:<><div className="notice-box"><b>阅读提示：</b>典籍文本为历史文献，版本与注释可能存在差异；本站内容仅供文化学习，不构成诊疗建议。</div>{headings.length>0&&<nav className="toc-box" aria-label="章节目录"><h2>章节目录</h2><ol className="toc-list">{headings.map((heading,i)=><li key={`${heading.id}-${i}`} style={{paddingLeft:`${Math.max(0,heading.depth-1)*14}px`}}><a href={`#${encodeURIComponent(heading.id)}`}>{heading.title}</a></li>)}</ol></nav>}<div className="reading-area"><MarkdownReader content={content}/></div></>}<div style={{display:'flex',gap:18,marginTop:25,fontSize:12}}><Link className="text-link" href="/books">← 返回医典阁</Link><Link className="text-link" href="/admin">上传书籍</Link></div></div>
}
export function generateStaticParams(){return getBooks().map((book)=>({slug:book.slug}))}
