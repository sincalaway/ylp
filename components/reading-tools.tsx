'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
export function SearchForm({ placeholder = '搜索本草、古籍与文章…', defaultValue = '' }: { placeholder?: string; defaultValue?: string }) {
 const [q, setQ] = useState(defaultValue)
 return <form action="/search" className="search-form"><label className="sr-only" htmlFor="site-search">搜索站内内容</label><input id="site-search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}/><button type="submit">搜索</button></form>
}
export function MarkdownReader({ content }: { content: string }) { return <div className="prose-reader"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>{content}</ReactMarkdown></div> }
export function ReadingTracker({ slug }: { slug: string }) {
 const [progress, setProgress] = useState(0)
 useEffect(() => {
  const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; const value = max > 0 ? Math.round(window.scrollY / max * 100) : 0; setProgress(value); if (value > 5) localStorage.setItem(`reading:${slug}`, String(value)) }
  const saved = localStorage.getItem(`reading:${slug}`); let initialFrame=0; if(saved) initialFrame=window.requestAnimationFrame(()=>setProgress(Number(saved)))
  window.addEventListener('scroll', update, { passive: true }); const scrollFrame=window.requestAnimationFrame(update)
  return () => { window.cancelAnimationFrame(initialFrame);window.cancelAnimationFrame(scrollFrame);window.removeEventListener('scroll', update) }
 }, [slug])
 return <div className="reading-progress" aria-label={`阅读进度 ${progress}%`}><span>阅读进度</span><div><i style={{ width: `${progress}%` }}/></div><b>{progress}%</b></div>
}
