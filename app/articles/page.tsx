import type { Metadata } from 'next'
import { getArticles } from '@/lib/content'
import { ArticleCard, PageHeading } from '@/components/content-cards'
export const dynamic='force-dynamic'
export const metadata: Metadata = { title: '岐黄论｜中医理论与文化文章', description: '阅读中医理论、古籍导读、本草文化与传统养生观念文章。' }
export default function ArticlesPage() { const articles=getArticles();const cats=Array.from(new Set(articles.map((a)=>a.category)));return <div className="container"><PageHeading eyebrow="READING NOTES · 岐黄拾简" title="岐黄论" intro="在经典与当代之间，分享中医理论、养生文化与古籍导读。我们尊重传统，也坚持审慎阅读。"/><div className="filter-list" style={{justifyContent:'center',marginBottom:25}}>{cats.map((c)=><span key={c} className="filter-chip">{c}</span>)}</div><div className="article-grid">{articles.map((article)=><ArticleCard key={article.slug} article={article}/>)}</div></div> }
