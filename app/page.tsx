import Link from 'next/link'
import { ArrowRight, BookOpen, Compass, Leaf, ScrollText, Sparkles } from 'lucide-react'
import { getArticles, getBooks, getHerbs, getHomeConfig } from '@/lib/content'
import { ArticleCard, BookCard, HerbCard, SectionHeading } from '@/components/content-cards'
import { SearchForm } from '@/components/reading-tools'
export const dynamic='force-dynamic'
export default function HomePage() {
 const home=getHomeConfig();const herbs=getHerbs();const articles=getArticles()
 const featuredHerbs=home.featuredHerbs.map((slug)=>herbs.find((x)=>x.slug===slug)).filter((x):x is typeof herbs[number]=>Boolean(x))
 const featuredBooks=getBooks().filter((x)=>home.featuredBooks.includes(x.slug)).slice(0,3)
 const featuredArticles=home.featuredArticles.map((slug)=>articles.find((x)=>x.slug===slug)).filter((x):x is typeof articles[number]=>Boolean(x))
 return <>
  <section className="home-hero"><div className="hero-art" aria-hidden="true"/><div className="hero-seal" aria-hidden="true">本草<br/>有约</div><div className="hero-content fade-in"><span className="hero-kicker">PUBLIC HERBAL CULTURE · EST. 2026</span><h1>草木有本<br/><em>典籍有光</em></h1><p className="hero-subtitle">御洛平公益本草文化平台</p><p className="hero-desc">以本草为引，以典籍为桥。让古老的医药智慧，在当代的阅读与分享中焕发新意。</p><div className="hero-buttons"><Link className="btn-primary" href="/books">走进医典阁 <ArrowRight size={15}/></Link><Link className="btn-outline" href="/herbs">寻味本草 <Leaf size={15}/></Link></div><div className="hero-note">公益开放　·　典籍共读　·　文化传承</div></div></section>
  <div className="ornament-line"/>
  <section className="container home-section"><div className="intro-band"><div><h2>为草木立传，为医道留灯</h2><p>{home.announcement || '御洛平公益本草文化平台，致力于整理与分享本草知识、中医理论和传统医药典籍。我们尊重经典，也倡导在历史语境中审慎阅读、理性认识。'}</p></div><div className="intro-mark"><Sparkles size={24}/></div></div></section>
  <section className="container home-section"><SectionHeading eyebrow="HERBAL COLLECTION · 本草拾珍" title="本草堂 · 草木识名" href="/herbs"/><div className="grid-herbs">{featuredHerbs.map((herb) => <HerbCard key={herb.slug} herb={herb}/>)}</div></section>
  <section className="container home-section"><SectionHeading eyebrow="CLASSICS LIBRARY · 典籍共读" title="医典阁 · 纸上千年" href="/books"/><div className="book-grid">{featuredBooks.map((book) => <BookCard key={book.slug} book={book}/>)}</div></section>
  <section className="container home-section"><SectionHeading eyebrow="READING NOTES · 岐黄拾简" title="新近文章 · 读古知今" href="/articles"/><div className="article-grid">{featuredArticles.map((article) => <ArticleCard key={article.slug} article={article}/>)}</div></section>
  <section className="container"><div className="pathway"><Link href="/herbs"><span className="pathway-icon"><Leaf size={19}/></span><span><b>本草分类</b><small>按部类寻访草木</small></span></Link><Link href="/books"><span className="pathway-icon"><BookOpen size={19}/></span><span><b>古籍阅读</b><small>在典籍间循迹医道</small></span></Link><Link href="/articles"><span className="pathway-icon"><ScrollText size={19}/></span><span><b>理论文章</b><small>从经典走向当代</small></span></Link><Link href="/culture"><span className="pathway-icon"><Compass size={19}/></span><span><b>文化故事</b><small>读人物与传承故事</small></span></Link></div></section>
  <section className="container home-section"><SectionHeading eyebrow="OPEN KNOWLEDGE · 公益共读" title="从一味草木，开始探索"/><div style={{maxWidth:540}}><SearchForm/></div></section>
 </>
}
