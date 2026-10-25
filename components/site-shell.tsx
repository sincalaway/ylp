'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, Search, X, Sprout } from 'lucide-react'
const links = [
  { href: '/', label: '首页' }, { href: '/herbs', label: '本草堂' }, { href: '/books', label: '医典阁' },
  { href: '/articles', label: '岐黄论' }, { href: '/culture', label: '文化志' }, { href: '/about', label: '关于我们' }
]
export function Header() {
  const pathname = usePathname(); const [open, setOpen] = useState(false)
  return <header className="site-header">
    <div className="topline"><span>传承本草智慧 · 分享中医文化</span><span className="topline-note">公益开放 · 仅供文化学习</span></div>
    <div className="nav-wrap">
      <Link href="/" className="brand" aria-label="御洛平公益本草文化平台首页"><span className="brand-mark"><Sprout size={25}/></span><span><b>御洛平</b><small>公益本草文化平台</small></span></Link>
      <nav className={open ? 'main-nav open' : 'main-nav'} aria-label="主导航">{links.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={(pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) ? 'active' : ''}>{item.label}</Link>)}</nav>
      <div className="nav-actions"><Link className="nav-search" href="/search" aria-label="搜索"><Search size={19}/><span>搜一搜</span></Link><button className="menu-toggle" aria-label={open ? '关闭菜单' : '打开菜单'} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div>
    </div>
  </header>
}
export function Footer() {
  return <footer className="site-footer"><div className="footer-inner"><div className="footer-brand"><div className="brand"><span className="brand-mark"><Sprout size={23}/></span><span><b>御洛平</b><small>公益本草文化平台</small></span></div><p>以开放、审慎、友善的方式，记录和分享中医药文化。</p></div><div className="footer-links"><div><b>文化典藏</b><Link href="/herbs">本草堂</Link><Link href="/books">医典阁</Link><Link href="/articles">岐黄论</Link></div><div><b>了解平台</b><Link href="/culture">文化志</Link><Link href="/about">公益说明</Link><Link href="/admin">内容管理</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} 御洛平公益本草文化平台</span><span>古籍与本草内容用于文化学习，不构成医疗建议。</span></div></footer>
}
