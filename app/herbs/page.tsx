import Link from 'next/link'
import type { Metadata } from 'next'
import { getHerbs } from '@/lib/content'
import { HerbCard, PageHeading } from '@/components/content-cards'
import { SearchForm } from '@/components/reading-tools'
export const dynamic='force-dynamic'
export const metadata: Metadata = { title: '本草堂｜本草百科', description: '按传统部类认识常见本草，查看性味归经、功效与传统用法。内容仅供文化学习。' }
const categories = ['全部', '草部', '木部', '果部', '菜部', '谷部', '金石部', '虫鱼部', '禽兽部', '菌藻部']
export default async function HerbsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
 const params=await searchParams;const q=(params.q||'').trim().toLowerCase();const category=params.category||'全部';const herbs=getHerbs()
 const filtered = herbs.filter((h) => (category === '全部' || h.category.startsWith(category.replace('部',''))) && (!q || [h.name,h.pinyin,h.effects,h.category,h.description].join(' ').toLowerCase().includes(q)))
 return <><div className="container"><PageHeading eyebrow="HERBAL ENCYCLOPEDIA · 本草百科" title="本草堂" intro="循着草木的名字，走近传统本草知识。条目以文化介绍为主，所载传统功效与用法不构成医疗建议。"/><div className="toolbar"><div className="filter-list">{categories.map((c) => <Link key={c} className={`filter-chip ${category===c?'active':''}`} href={c==='全部'?'/herbs':`/herbs?category=${encodeURIComponent(c)}`}>{c}</Link>)}</div><SearchForm placeholder="搜索药名、拼音或功效…" defaultValue={q}/></div>{q && <p className="results-note">“{q}” 找到 {filtered.length} 味本草</p>}{filtered.length ? <div className="grid-herbs">{filtered.map((herb) => <HerbCard key={herb.slug} herb={herb}/>)}</div> : <div className="empty-state">没有找到相关本草。试试其他关键词。</div>}<div className="notice-box" style={{marginTop:24}}><b>阅读提示：</b>本草条目介绍传统文献知识及常见炮制、用法信息；药材品种、质量、配伍及个体差异都会影响安全性，请勿据此自行用药。</div></div></>
}
