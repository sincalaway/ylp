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
export function ReadingTracker({ slug, book }: { slug: string; book?: string }) {
 const [progress, setProgress] = useState(0)
 useEffect(() => {
  const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; const value = max > 0 ? Math.round(window.scrollY / max * 100) : 0; setProgress(value); if (value > 5) localStorage.setItem(`reading:${slug}`, String(value)) }
  if (book) { const chapter = slug.slice(book.length + 1); if (chapter) localStorage.setItem(`reading-last:${book}`, chapter) }
  const saved = localStorage.getItem(`reading:${slug}`); let initialFrame=0; if(saved) initialFrame=window.requestAnimationFrame(()=>setProgress(Number(saved)))
  window.addEventListener('scroll', update, { passive: true }); const scrollFrame=window.requestAnimationFrame(update)
  return () => { window.cancelAnimationFrame(initialFrame);window.cancelAnimationFrame(scrollFrame);window.removeEventListener('scroll', update) }
 }, [slug, book])
 return <div className="reading-progress" aria-label={`阅读进度 ${progress}%`}><span>阅读进度</span><div><i style={{ width: `${progress}%` }}/></div><b>{progress}%</b></div>
}

/** On a folder book's contents page: offer to resume the chapter last opened on this device. */
export function ContinueReading({ slug, chapters }: { slug: string; chapters: { slug: string; title: string }[] }) {
 const [last, setLast] = useState<{ slug: string; title: string } | null>(null)
 useEffect(() => {
  const saved = localStorage.getItem(`reading-last:${slug}`); const found = chapters.find((c) => c.slug === saved) || null
  const frame = window.requestAnimationFrame(() => setLast(found)); return () => window.cancelAnimationFrame(frame)
 }, [slug, chapters])
 if (!last) return null
 return <p className="continue-reading">上次读到：<a className="text-link" href={`/books/${slug}/${last.slug}`}>{last.title} →</a></p>
}
/** Old links such as /books/ben-cao-gang-mu-yuanwen#人參 pointed into a single page; send them to the chapter now holding that entry. */
export function GangmuHashRedirect() {
 useEffect(() => {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''))
  if (!hash) return
  fetch(`/api/books/gangmu?name=${encodeURIComponent(hash)}`).then((r) => r.ok ? r.json() : null).then((j: { href?: string } | null) => { if (j?.href) window.location.replace(j.href) }).catch(() => {})
 }, [])
 return null
}
