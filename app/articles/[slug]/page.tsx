import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArticle } from '@/lib/content'
import { MarkdownReader } from '@/components/reading-tools'
export const dynamic='force-dynamic'
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const a=getArticle(slug);return{title:a?`${a.title}｜岐黄论`:'文章',description:a?.excerpt}}
export default async function ArticleDetailPage({params}:{params:Promise<{slug:string}>}) {const {slug}=await params;const article=getArticle(slug);if(!article)notFound();return <div className="detail-layout"><div className="detail-top"><span className="eyebrow">{article.category} · READING NOTE</span><h1>{article.title}</h1><div className="article-meta"><span>{article.date}</span><span>{article.readTime}</span><span>御洛平文化整理</span></div><p className="detail-sub" style={{marginTop:15}}>{article.excerpt}</p></div><div className="reading-area"><MarkdownReader content={article.content}/><div className="notice-box" style={{marginTop:32}}><b>阅读提示：</b>本文为传统文化与知识介绍，不构成诊断或治疗建议。如有健康问题，请咨询正规医疗机构。</div><p style={{marginTop:24,fontSize:12}}><Link className="text-link" href="/articles">← 返回岐黄论</Link></p></div></div>}
