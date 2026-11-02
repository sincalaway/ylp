'use client'
// 医典阁正文全文检索：浏览器内加载 Pagefind 静态索引（public/pagefind，由 scripts/build-pagefind.mjs 生成），无需服务器。
// 索引正文已做繁→简归一，query 由服务端用同一张表折叠后传入（foldedQuery）。
import Link from 'next/link'
import { useEffect, useState } from 'react'

type SubResult = { title: string; url: string; excerpt: string }
type Hit = { url: string; title: string; book?: string; author?: string; excerpt: string; subs: SubResult[] }
type PagefindResult = { data: () => Promise<{ url: string; excerpt: string; meta: Record<string, string>; sub_results?: SubResult[] }> }
type Pagefind = { options: (o: Record<string, unknown>) => Promise<void>; mergeIndex: (url: string, o?: Record<string, unknown>) => Promise<void>; search: (q: string, o?: Record<string, unknown>) => Promise<{ results: PagefindResult[] } | null> }

let pagefindPromise: Promise<Pagefind> | null = null
function loadPagefind() {
  if (!pagefindPromise) {
    // 索引按书分片（public/pagefind/<n>/），首片提供 pagefind.js，其余分片在浏览器端合并
    pagefindPromise = fetch('/pagefind/shards.json').then((r) => r.json() as Promise<{ shards: string[] }>).then(async ({ shards }) => {
      const url = `${shards[0]}pagefind.js`
      const pf = await (import(/* webpackIgnore: true */ /* @vite-ignore */ url) as Promise<Pagefind>)
      await pf.options({ excerptLength: 40, basePath: shards[0] })
      for (const extra of shards.slice(1)) await pf.mergeIndex(extra)
      return pf
    })
    pagefindPromise.catch(() => { pagefindPromise = null })
  }
  return pagefindPromise
}
const PAGE = 20
// Pagefind 的 excerpt 只含 <mark> 标记，其余已转义；这里只放行 <mark>
// Pagefind 由 HTML 文件名生成 url（…/02-juan-yi.html#id），站内路由不带 .html
const route = (url: string) => url.replace(/\.html(?=#|$)/, '')
const safe = (html: string) => html.replace(/<(?!\/?mark>)[^>]*>/g, '')

export function FullTextSearch({ foldedQuery }: { foldedQuery: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [results, setResults] = useState<PagefindResult[]>([])
  const [hits, setHits] = useState<Hit[]>([])
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let alive = true
    setState('loading'); setHits([]); setShown(PAGE)
    // 古籍连写无空格，默认按整句精确匹配；无结果时再退回分词检索
    const exact = `"${foldedQuery.replace(/"/g, '')}"`
    loadPagefind().then(async (pf) => { const r = await pf.search(exact); return r?.results.length ? r : pf.search(foldedQuery) }).then((res) => { if (!alive) return; setResults(res?.results || []); setState('ready') }).catch(() => alive && setState('error'))
    return () => { alive = false }
  }, [foldedQuery])

  useEffect(() => {
    let alive = true
    const need = results.slice(hits.length, shown)
    if (!need.length) return
    Promise.all(need.map((r) => r.data())).then((data) => {
      if (!alive) return
      setHits((prev) => [...prev, ...data.map((d) => ({ url: route(d.url), title: d.meta.title || d.url, book: d.meta.book, author: d.meta.author, excerpt: d.excerpt, subs: (d.sub_results || []).filter((s) => s.url.includes('#')).slice(0, 3).map((s) => ({ ...s, url: route(s.url) })) }))])
    })
    return () => { alive = false }
  }, [results, shown, hits.length])

  if (state === 'error') return <section className="search-section"><h2>典籍正文</h2><p className="results-note">正文索引暂时无法加载，请稍后再试。</p></section>
  if (state === 'loading') return <section className="search-section"><h2>典籍正文</h2><p className="results-note">正在检索 200 部古籍正文…</p></section>
  if (!results.length) return <section className="search-section"><h2>典籍正文 · 0</h2><p className="results-note">正文中没有找到“{foldedQuery}”。古籍多为单字成词，可试试更短或更常见的说法。</p></section>
  return <section className="search-section">
    <h2>典籍正文 · {results.length} 篇</h2>
    <p className="results-note">按整句匹配、相关度排列；摘录统一为简体，点开即读繁体原文。</p>
    <ol className="fulltext-hits">
      {hits.map((h) => <li key={h.url}>
        <Link className="ft-title" href={h.url}>{h.title}</Link>{h.author ? <span className="ft-author">{h.author}</span> : null}
        {h.subs.length ? <ul>{h.subs.map((s) => <li key={s.url}><Link href={s.url}><b>{s.title}</b></Link><p dangerouslySetInnerHTML={{ __html: safe(s.excerpt) }}/></li>)}</ul>
          : <p dangerouslySetInnerHTML={{ __html: safe(h.excerpt) }}/>}
      </li>)}
    </ol>
    {shown < results.length && <button className="ft-more" onClick={() => setShown((n) => n + PAGE)}>再看 {Math.min(PAGE, results.length - shown)} 篇</button>}
  </section>
}
