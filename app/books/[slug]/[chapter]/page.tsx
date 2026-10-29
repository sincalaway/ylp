import Link from 'next/link'
import GithubSlugger from 'github-slugger'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getBookChapter, getBookChapters, getBooks } from '@/lib/content'
import { MarkdownReader, ReadingTracker } from '@/components/reading-tools'

type Params = { slug: string; chapter: string }
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
 const {slug,chapter}=await params;const item=getBookChapter(slug,chapter)
 return item?{title:`${item.chapter.title}｜${item.book.title}｜医典阁`,description:`《${item.book.title}》${item.chapter.title}原文。${item.book.summary}`}:{title:'典籍阅读'}
}
function ChapterNav({ slug, prev, next, index, total }: { slug: string; prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null; index: number; total: number }) {
 return <nav className="chapter-nav" aria-label="翻页">{prev?<Link rel="prev" href={`/books/${slug}/${prev.slug}`}><small>上一篇</small>{prev.title}</Link>:<span/>}<Link className="chapter-nav-toc" href={`/books/${slug}`}><small>目录</small>{index+1} / {total}</Link>{next?<Link rel="next" href={`/books/${slug}/${next.slug}`}><small>下一篇</small>{next.title}</Link>:<span/>}</nav>
}
export default async function ChapterPage({ params }: { params: Promise<Params> }) {
 const {slug,chapter}=await params;const item=getBookChapter(slug,chapter);if(!item)notFound()
 const {book,chapter:info,content,index,prev,next,source}=item;const total=getBookChapters(slug).length
 const slugger=new GithubSlugger();const headings=content.split('\n').flatMap((line)=>{const match=line.match(/^(#{2,4})\s+(.+)$/);if(!match)return[];const title=match[2].trim();return[{depth:match[1].length,title,id:slugger.slug(title)}]})
 const minDepth=headings.reduce((m,h)=>Math.min(m,h.depth),9)
 return <div className="detail-layout"><div className="detail-top"><span className="eyebrow"><Link href={`/books/${book.slug}`}>《{book.title}》</Link>　·　{book.dynasty}　{book.author}</span><h1>{info.title}</h1><p className="detail-sub">第 {index+1} / {total} 篇　·　约 {info.chars} 字</p></div>
  <ReadingTracker slug={`${book.slug}/${info.slug}`} book={book.slug}/>
  <ChapterNav slug={book.slug} prev={prev} next={next} index={index} total={total}/>
  <div className="notice-box"><b>阅读提示：</b>典籍文本为历史文献，版本与注释可能存在差异；本站内容仅供文化学习，不构成诊疗建议。</div>
  {headings.length>1&&<details className="toc-box" open={headings.length<=40}><summary><h2 style={{display:'inline'}}>本篇目录（{headings.length}）</h2></summary><ol className="toc-list">{headings.map((heading,i)=><li key={`${heading.id}-${i}`} style={{paddingLeft:`${(heading.depth-minDepth)*14}px`}}><a href={`#${encodeURIComponent(heading.id)}`}>{heading.title}</a></li>)}</ol></details>}
  <div className="reading-area"><MarkdownReader content={content}/></div>
  <ChapterNav slug={book.slug} prev={prev} next={next} index={index} total={total}/>
  {source&&<p className="source-line">原文来源：维基文库 <a className="text-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>{source.revid?`（修订版本 ${source.revid}）`:''}，公有领域（PD-old）。</p>}
  <div style={{display:'flex',gap:18,marginTop:18,fontSize:12}}><Link className="text-link" href={`/books/${book.slug}`}>← 返回《{book.title}》目录</Link><Link className="text-link" href="/books">医典阁</Link></div></div>
}
export function generateStaticParams(){return getBooks().filter((b)=>b.kind==='folder').flatMap((book)=>getBookChapters(book.slug).map((c)=>({slug:book.slug,chapter:c.slug})))}
