import Link from 'next/link'
import GithubSlugger from 'github-slugger'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { GANGMU_SLUG, getBook, getBooks } from '@/lib/content'
import { ContinueReading, GangmuHashRedirect, MarkdownReader, ReadingTracker } from '@/components/reading-tools'
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const {slug}=await params;const item=getBook(slug);return{title:item?`${item.book.title}｜医典阁`:'典籍阅读',description:item?.book.summary} }
const fmtChars=(n:number)=>n>=10000?`${(n/10000).toFixed(n>=100000?0:1)} 万字`:`${n} 字`
function SourceNote({ sources, license }: { sources: { title: string; url: string; revid?: number }[]; license?: string }) {
 if(!sources.length)return null
 return <div className="notice-box source-box"><b>文本来源：</b>维基文库（zh.wikisource.org）{license?`，${license}`:'，公有领域（PD-old）'}。本站仅转换格式，正文保留维基文库原字（多为繁体）。<details><summary>查看 {sources.length} 个来源页面与修订版本</summary><ul>{sources.map((s)=><li key={`${s.title}-${s.revid}`}><a className="text-link" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>{s.revid?`（修订版本 ${s.revid}）`:''}</li>)}</ul></details></div>
}
export default async function BookReadPage({ params }: { params: Promise<{ slug: string }> }) {
 const {slug}=await params;const result=getBook(slug);if(!result)notFound();const {book,content,chapters}=result
 if(book.kind==='folder'){
  return <div className="detail-layout"><div className="detail-top"><span className="eyebrow">COMPLETE TEXT · 古籍全本</span><h1>{book.title}</h1><p className="detail-sub">{book.dynasty}　·　{book.author}　·　{book.category}</p><p className="detail-sub" style={{marginTop:10}}>{book.summary}</p><p className="detail-sub book-stats">全本 {book.chapterCount} 篇（卷）　·　约 {fmtChars(book.chars)}</p></div>
   {book.slug===GANGMU_SLUG&&<GangmuHashRedirect/>}
   <ContinueReading slug={book.slug} chapters={chapters.map((c)=>({slug:c.slug,title:c.title}))}/>
   <div className="notice-box"><b>阅读提示：</b>典籍文本为历史文献，版本与注释可能存在差异；本站内容仅供文化学习，不构成诊疗建议。</div>
   <nav className="toc-box chapter-toc" aria-label="全书目录"><h2>目录</h2><ol className="toc-list">{chapters.map((c,i)=><li key={c.slug}><Link href={`/books/${book.slug}/${c.slug}`}><span className="chapter-no">{String(i+1).padStart(2,'0')}</span>{c.title}</Link><small className="chapter-meta">{fmtChars(c.chars)}{c.headings.length>0&&<>　·　{c.headings.slice(0,12).join('、')}{c.headings.length>12?` 等 ${c.headings.length} 篇`:''}</>}</small></li>)}</ol></nav>
   {chapters[0]&&<p style={{margin:'20px 0'}}><Link className="btn-primary" href={`/books/${book.slug}/${chapters[0].slug}`}>从第一篇开始阅读 →</Link></p>}
   <SourceNote sources={book.sources} license={book.license}/>
   <div style={{display:'flex',gap:18,marginTop:25,fontSize:12}}><Link className="text-link" href="/books">← 返回医典阁</Link></div></div>
 }
 const slugger=new GithubSlugger();const headings=content.split('\n').flatMap((line)=>{const match=line.match(/^(#{1,4})\s+(.+)$/);if(!match)return[];const title=match[2].trim();return[{depth:match[1].length,title,id:slugger.slug(title)}]})
 return <div className="detail-layout"><div className="detail-top"><span className="eyebrow">READING ROOM · 古籍阅读</span><h1>{book.title}</h1><p className="detail-sub">{book.dynasty}　·　{book.author}　·　{book.category}</p><p className="detail-sub" style={{marginTop:10}}>{book.summary}</p></div><ReadingTracker slug={book.slug}/>{book.format==='pdf'?<iframe title={`《${book.title}》PDF预览`} className="pdf-frame" src={`/api/books/pdf/${encodeURIComponent(book.slug)}`}/>:<><div className="notice-box"><b>阅读提示：</b>典籍文本为历史文献，版本与注释可能存在差异；本站内容仅供文化学习，不构成诊疗建议。</div>{headings.length>0&&<nav className="toc-box" aria-label="章节目录"><h2>章节目录</h2><ol className="toc-list">{headings.map((heading,i)=><li key={`${heading.id}-${i}`} style={{paddingLeft:`${Math.max(0,heading.depth-1)*14}px`}}><a href={`#${encodeURIComponent(heading.id)}`}>{heading.title}</a></li>)}</ol></nav>}<div className="reading-area"><MarkdownReader content={content}/></div></>}<div style={{display:'flex',gap:18,marginTop:25,fontSize:12}}><Link className="text-link" href="/books">← 返回医典阁</Link><Link className="text-link" href="/admin">上传书籍</Link></div></div>
}
export function generateStaticParams(){return getBooks().map((book)=>({slug:book.slug}))}
